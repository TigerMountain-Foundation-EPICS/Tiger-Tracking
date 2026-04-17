export type ReadingSource = "ble" | "demo";

export type ConnectionStatus =
  | "idle"
  | "scanning"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface SensorReading {
  id: string;
  timestamp: number;
  deviceId: string;
  source: ReadingSource;

  // SHT31
  temperatureC: number;
  humidityPct: number;

  // Dual soil moisture sensors
  soil1Raw: number;
  soil1Pct: number;
  soil2Raw: number;
  soil2Pct: number;

  // Diagnostics
  uptimeMs?: number;
  sdOk?: boolean;
  rssi?: number;
}

export interface DeviceMetadata {
  id: string;
  name: string;
  firmwareVersion?: string;
  rssi?: number;
  lastPacketAt?: number;
}

export interface ThresholdSettings {
  temperatureHighC: number;
  humidityLowPct: number;
  soilLowPct: number;
}

export interface AppSettings {
  demoMode: boolean;
  demoConnected: boolean;
  units: "C" | "F";
  thresholds: ThresholdSettings;
  firebaseEnabled: boolean;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface DailyAggregate {
  id: string;
  day: string;
  deviceId: string;
  count: number;
  minTemperatureC: number;
  maxTemperatureC: number;
  avgTemperatureC: number;
  minHumidityPct: number;
  maxHumidityPct: number;
  avgHumidityPct: number;
  minSoil1Pct: number;
  maxSoil1Pct: number;
  avgSoil1Pct: number;
  minSoil2Pct: number;
  maxSoil2Pct: number;
  avgSoil2Pct: number;
}

// Raw JSON shape sent by ESP32 over BLE
export interface EspBlePayload {
  device_id: string;
  soil_1_raw: number;
  soil_1_pct: number;
  soil_2_raw: number;
  soil_2_pct: number;
  temperature_c: number;
  humidity_pct: number;
  uptime_ms: number;
  sd_ok: boolean;
}

export interface ConnectionSnapshot {
  status: ConnectionStatus;
  device: DeviceMetadata | null;
  lastPacketAt: number | null;
  error: string | null;
}