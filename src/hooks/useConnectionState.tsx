import { User } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { bleService } from "../services/ble";
import { DEFAULT_DEMO_DEVICE_ID, DemoDataGenerator } from "../services/demo";
import { firebaseService } from "../services/firebase";
import { ConnectionSnapshot, SensorReading } from "../types";
import { useSettings } from "./useSettings";
import { useToast } from "./useToast";

const MAX_READINGS = 800;
const LAST_READING_KEY = "sensor.last.reading.v1";

interface ConnectionStateValue {
  snapshot: ConnectionSnapshot;
  readings: SensorReading[];
  latestReading: SensorReading | null;
  isBleSupported: boolean;
  localOnly: boolean;
  user: User | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  clearReadings: () => void;
  logReading: (reading?: SensorReading | null) => Promise<{ synced: boolean }>;
  flushPending: () => Promise<void>;
}

const ConnectionStateContext = createContext<ConnectionStateValue | null>(null);

export const ConnectionStateProvider = ({ children }: { children: React.ReactNode }) => {
  const { settings, setDemoConnected } = useSettings();
  const { pushToast } = useToast();

  const [bleSnapshot, setBleSnapshot] = useState<ConnectionSnapshot>(bleService.getSnapshot());
  const [demoLastPacketAt, setDemoLastPacketAt] = useState<number | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [user, setUser] = useState<User | null>(null);

  // ── Last known reading — persisted to localStorage ──────────────────────────
  const [lastKnownReading, setLastKnownReading] = useState<SensorReading | null>(() => {
    try {
      const stored = localStorage.getItem(LAST_READING_KEY);
      return stored ? (JSON.parse(stored) as SensorReading) : null;
    } catch {
      return null;
    }
  });

  const persistLastKnown = useCallback((reading: SensorReading) => {
    setLastKnownReading(reading);
    try {
      localStorage.setItem(LAST_READING_KEY, JSON.stringify(reading));
    } catch {
      // storage full — ignore
    }
  }, []);

  const demoGeneratorRef = useRef<DemoDataGenerator | null>(null);
  const previousStatus   = useRef<string>(bleSnapshot.status);

  const pushReading = useCallback(
    (reading: SensorReading) => {
      setReadings((current) => [reading, ...current].slice(0, MAX_READINGS));
      persistLastKnown(reading);
    },
    [persistLastKnown]
  );

  // ── BLE connection + reading listeners ───────────────────────────────────────
  useEffect(() => {
    const unsubConn = bleService.onConnection((next) => {
      setBleSnapshot(next);
      const prev = previousStatus.current;
      if (prev !== "connected" && next.status === "connected") {
        pushToast(`Connected to ${next.device?.name ?? "ESP32"}`, "success");
      }
      if (prev === "connected" && next.status === "disconnected") {
        pushToast("Device disconnected — showing last known data", "warning");
      }
      if (next.status === "error" && next.error) {
        pushToast(next.error, "error");
      }
      previousStatus.current = next.status;
    });

    const unsubRead = bleService.onReading((reading) => {
  pushReading(reading);
  // Auto-sync every BLE reading to Firebase
  if (settings.firebaseEnabled && firebaseService.isEnabled()) {
    firebaseService.logReading(reading).then((result) => {
      if (result.synced) {
        console.log("[Firebase] Reading synced:", reading.deviceId);
      }
    }).catch((err) => {
      console.error("[Firebase] Auto-sync failed:", err);
    });
  }
});

    return () => {
      unsubConn();
      unsubRead();
    };
  }, [pushReading, pushToast]);

  // ── Demo mode ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (settings.demoMode) {
      demoGeneratorRef.current?.stop();
      demoGeneratorRef.current = new DemoDataGenerator();
      demoGeneratorRef.current.start({
        connected: settings.demoConnected,
        deviceId:  DEFAULT_DEMO_DEVICE_ID,
        onReading: (reading) => {
          setDemoLastPacketAt(reading.timestamp);
          pushReading(reading);
        },
      });
      return;
    }
    demoGeneratorRef.current?.stop();
    demoGeneratorRef.current = null;
  }, [settings.demoConnected, settings.demoMode, pushReading]);

  // ── Online: flush pending ────────────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      firebaseService.flushPending().then((result) => {
        if (result.synced > 0) {
          pushToast(`Synced ${result.synced} pending readings`, "success");
        }
      });
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [pushToast]);

  // ── Effective snapshot ───────────────────────────────────────────────────────
  const effectiveSnapshot: ConnectionSnapshot = useMemo(() => {
    if (!settings.demoMode) return bleSnapshot;
    return {
      status:      settings.demoConnected ? "connected" : "disconnected",
      error:       null,
      lastPacketAt: demoLastPacketAt,
      device: {
        id:              DEFAULT_DEMO_DEVICE_ID,
        name:            "Demo ESP32",
        firmwareVersion: "demo-1.0",
        lastPacketAt:    demoLastPacketAt ?? undefined,
      },
    };
  }, [bleSnapshot, demoLastPacketAt, settings.demoConnected, settings.demoMode]);

  // ── Latest reading: live if available, last known if disconnected ─────────────
  const latestReading = useMemo<SensorReading | null>(() => {
    // If we have a live reading in this session, always use it
    if (readings.length > 0) return readings[0];
    // No live readings yet — fall back to last known from previous session
    return lastKnownReading;
  }, [readings, lastKnownReading]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (settings.demoMode) {
      setDemoConnected(true);
      pushToast("Demo device connected", "success");
      return;
    }
    await bleService.scanAndConnect();
  }, [settings.demoMode, pushToast, setDemoConnected]);

  const disconnect = useCallback(async () => {
    if (settings.demoMode) {
      setDemoConnected(false);
      pushToast("Demo device disconnected", "info");
      return;
    }
    await bleService.disconnect();
  }, [settings.demoMode, pushToast, setDemoConnected]);

  const reconnect = useCallback(async () => {
    if (settings.demoMode) {
      setDemoConnected(true);
      pushToast("Demo device reconnected", "success");
      return;
    }
    await bleService.reconnect();
  }, [settings.demoMode, pushToast, setDemoConnected]);

  const clearReadings = useCallback(() => setReadings([]), []);

  const logReading = useCallback(
    async (reading?: SensorReading | null) => {
      const target = reading ?? latestReading;
      if (!target) throw new Error("No reading available to log.");

      const result = settings.firebaseEnabled
        ? await firebaseService.logReading(target)
        : await firebaseService.logReadingLocalOnly(target);

      if (result.synced) {
        pushToast("Reading synced", "success");
      } else {
        pushToast("Saved locally. Will sync when available.", "warning");
      }
      return result;
    },
    [latestReading, pushToast, settings.firebaseEnabled]
  );

  const flushPending = useCallback(async () => {
    if (!settings.firebaseEnabled) {
      pushToast("Firebase sync disabled in settings", "info");
      return;
    }
    const result = await firebaseService.flushPending();
    if (result.synced > 0) {
      pushToast(`Synced ${result.synced} readings`, "success");
      return;
    }
    if (result.failed > 0) {
      pushToast(`${result.failed} readings still pending`, "warning");
    }
  }, [pushToast, settings.firebaseEnabled]);

  const value = useMemo<ConnectionStateValue>(
    () => ({
      snapshot:      effectiveSnapshot,
      readings,
      latestReading,
      isBleSupported: bleService.isSupported(),
      localOnly:     !settings.firebaseEnabled || !firebaseService.isEnabled(),
      user,
      connect,
      disconnect,
      reconnect,
      clearReadings,
      logReading,
      flushPending,
    }),
    [
      connect, disconnect, effectiveSnapshot, flushPending,
      latestReading, logReading, readings, reconnect,
      settings.firebaseEnabled, user, clearReadings,
    ]
  );

  return (
    <ConnectionStateContext.Provider value={value}>
      {children}
    </ConnectionStateContext.Provider>
  );
};

export const useConnectionState = (): ConnectionStateValue => {
  const context = useContext(ConnectionStateContext);
  if (!context) {
    throw new Error("useConnectionState must be used inside ConnectionStateProvider.");
  }
  return context;
};