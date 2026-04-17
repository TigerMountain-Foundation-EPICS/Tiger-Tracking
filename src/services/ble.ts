import {
  ConnectionSnapshot,
  ConnectionStatus,
  DeviceMetadata,
  EspBlePayload,
  SensorReading,
} from "../types";

// ── Your ESP32 UUIDs ──────────────────────────────────────────────────────────
export const BLE_SERVICE_UUID = "19b10000-e8f2-537e-4f6c-d104768a1214";
export const BLE_NOTIFY_CHARACTERISTIC_UUID = "19b10001-e8f2-537e-4f6c-d104768a1214";

const decoder = new TextDecoder();

type ReadingListener = (reading: SensorReading) => void;
type ConnectionListener = (snapshot: ConnectionSnapshot) => void;

export class BleService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private notifyCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private status: ConnectionStatus = "idle";
  private lastPacketAt: number | null = null;
  private error: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private maxReconnectAttempts = 6;
  private manualDisconnect = false;
  private readingListeners = new Set<ReadingListener>();
  private connectionListeners = new Set<ConnectionListener>();

  isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  onReading(listener: ReadingListener): () => void {
    this.readingListeners.add(listener);
    return () => this.readingListeners.delete(listener);
  }

  onConnection(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.getSnapshot());
    return () => this.connectionListeners.delete(listener);
  }

  getSnapshot(): ConnectionSnapshot {
    return {
      status: this.status,
      device: this.device
        ? {
            id: this.device.id || "esp32-greenhouse-1",
            name: this.device.name || "ESP32-Greenhouse",
            lastPacketAt: this.lastPacketAt ?? undefined,
            rssi: undefined,
          }
        : null,
      lastPacketAt: this.lastPacketAt,
      error: this.error,
    };
  }

  async scanAndConnect(): Promise<void> {
    if (!this.isSupported()) {
      this.setState("error", "Web Bluetooth is not supported in this browser.");
      return;
    }

    this.manualDisconnect = false;
    this.setState("scanning");

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: "ESP32-Greenhouse" }],
        optionalServices: [BLE_SERVICE_UUID],
      });
      await this.connect(device);
    } catch (err) {
      const message = err instanceof Error ? err.message : "BLE scan cancelled";
      this.setState("disconnected", message);
    }
  }

  async disconnect(): Promise<void> {
    this.manualDisconnect = true;
    this.clearReconnectTimer();

    if (this.notifyCharacteristic) {
      this.notifyCharacteristic.removeEventListener(
        "characteristicvaluechanged",
        this.handleCharacteristicChange as EventListener
      );
    }

    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }

    this.notifyCharacteristic = null;
    this.server = null;
    this.setState("disconnected");
  }

  async reconnect(): Promise<void> {
    if (!this.device) throw new Error("No previously connected device.");
    this.manualDisconnect = false;
    await this.connect(this.device, true);
  }

  private async connect(device: BluetoothDevice, isReconnect = false): Promise<void> {
    this.device = device;
    this.device.removeEventListener(
      "gattserverdisconnected",
      this.handleDisconnect as EventListener
    );
    this.device.addEventListener(
      "gattserverdisconnected",
      this.handleDisconnect as EventListener
    );

    this.setState(isReconnect ? "reconnecting" : "connecting");

    const server = await device.gatt?.connect();
    if (!server) throw new Error("Failed to open GATT server.");
    this.server = server;

    const service = await server.getPrimaryService(BLE_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(
      BLE_NOTIFY_CHARACTERISTIC_UUID
    );
    await characteristic.startNotifications();
    characteristic.addEventListener(
      "characteristicvaluechanged",
      this.handleCharacteristicChange as EventListener
    );

    this.notifyCharacteristic = characteristic;
    this.reconnectAttempts = 0;
    this.error = null;
    this.setState("connected");
  }

  private handleCharacteristicChange = (event: Event): void => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;

    const reading = this.parsePayload(target.value);
    if (!reading) return;

    this.lastPacketAt = reading.timestamp;
    this.readingListeners.forEach((l) => l(reading));
    this.notifyConnectionListeners();
  };

  private parsePayload(value: DataView): SensorReading | null {
    try {
      const uint8 = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      const text = decoder.decode(uint8).trim().replace(/\0+$/g, "");

      if (!text.startsWith("{")) return null;

      const p = JSON.parse(text) as Partial<EspBlePayload>;

      // Validate required fields
      if (
        p.temperature_c === undefined ||
        p.humidity_pct === undefined ||
        p.soil_1_pct === undefined ||
        p.soil_2_pct === undefined
      ) {
        console.warn("[BLE] Missing required fields in payload:", p);
        return null;
      }

      return {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        deviceId: p.device_id ?? "esp32-greenhouse-1",
        source: "ble",
        temperatureC: p.temperature_c,
        humidityPct: p.humidity_pct,
        soil1Raw: p.soil_1_raw ?? 0,
        soil1Pct: p.soil_1_pct,
        soil2Raw: p.soil_2_raw ?? 0,
        soil2Pct: p.soil_2_pct,
        uptimeMs: p.uptime_ms,
        sdOk: p.sd_ok,
      };
    } catch (err) {
      console.error("[BLE] Failed to parse payload:", err);
      return null;
    }
  }

  private handleDisconnect = (): void => {
    if (this.manualDisconnect) return;
    this.server = null;
    this.notifyCharacteristic = null;
    this.tryReconnect();
  };

  private async tryReconnect(): Promise<void> {
    if (!this.device) {
      this.setState("disconnected", "Device disconnected.");
      return;
    }
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setState("error", "Unable to reconnect to BLE device.");
      return;
    }

    this.setState(
      "reconnecting",
      `Reconnecting (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`
    );

    const delay = Math.min(16000, 1000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.clearReconnectTimer();

    this.reconnectTimer = window.setTimeout(async () => {
      try {
        await this.connect(this.device as BluetoothDevice, true);
      } catch {
        await this.tryReconnect();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(status: ConnectionStatus, error: string | null = null): void {
    this.status = status;
    this.error = error;
    this.notifyConnectionListeners();
  }

  private notifyConnectionListeners(): void {
    const snapshot = this.getSnapshot();
    this.connectionListeners.forEach((l) => l(snapshot));
  }
}

export const bleService = new BleService();