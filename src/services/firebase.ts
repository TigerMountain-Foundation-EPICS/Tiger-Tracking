/**
 * firebase.ts — Realtime Database integration
 * Matches your existing Firebase project: tmf-epics-default-rtdb
 * Readings are written to the "readings" node, same as greenhouse_server.py
 */

import { initializeApp, FirebaseApp } from "firebase/app";
import { getDatabase, ref, push, query, orderByChild, limitToLast, get, Database } from "firebase/database";
import { SensorReading, DailyAggregate } from "../types";
import { aggregateByDay } from "./demo";
import { storage } from "../utils/storage";

const LOCAL_READINGS_KEY = "sensor.local.readings.v2";
const LOCAL_PENDING_KEY  = "sensor.local.pending.v2";
const LOCAL_SESSION_KEY  = "sensor.local.session.v2";

// ── Env ───────────────────────────────────────────────────────────────────────
const env = {
  enabled:           import.meta.env.VITE_FIREBASE_ENABLED === "true",
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            as string,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        as string,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         as string,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             as string,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL       as string,
};

const firebaseConfigured =
  env.enabled &&
  Boolean(
    env.apiKey &&
    env.authDomain &&
    env.projectId &&
    env.databaseURL
  );

let firebaseApp: FirebaseApp | null = null;
let db: Database | null = null;

if (firebaseConfigured) {
  firebaseApp = initializeApp({
    apiKey:            env.apiKey,
    authDomain:        env.authDomain,
    projectId:         env.projectId,
    storageBucket:     env.storageBucket,
    messagingSenderId: env.messagingSenderId,
    appId:             env.appId,
    databaseURL:       env.databaseURL,
  });
  db = getDatabase(firebaseApp);
}

// ── Local storage helpers ─────────────────────────────────────────────────────
const readLocal  = (): SensorReading[] => storage.get<SensorReading[]>(LOCAL_READINGS_KEY, []);
const writeLocal = (r: SensorReading[]) => storage.set(LOCAL_READINGS_KEY, r);
const readPending  = (): SensorReading[] => storage.get<SensorReading[]>(LOCAL_PENDING_KEY, []);
const writePending = (r: SensorReading[]) => storage.set(LOCAL_PENDING_KEY, r);

const normalize = (r: SensorReading): SensorReading => ({
  ...r,
  id: r.id || crypto.randomUUID(),
  source: r.source || "ble",
});

const dedupeSort = (readings: SensorReading[]): SensorReading[] => {
  const map = new Map<string, SensorReading>();
  readings.forEach((r) => map.set(r.id, r));
  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
};

const upsertLocal = (r: SensorReading): void => {
  const next = dedupeSort([normalize(r), ...readLocal()]).slice(0, 2000);
  writeLocal(next);
};

// ── Remote write ──────────────────────────────────────────────────────────────
const writeRemote = async (reading: SensorReading): Promise<void> => {
  if (!db) throw new Error("Realtime Database unavailable.");

  // Write to "readings" node — same path greenhouse_server.py uses via ref.push()
  const readingsRef = ref(db, "readings");
  await push(readingsRef, {
    device_id:     reading.deviceId,
    temperature_c: reading.temperatureC,
    humidity_pct:  reading.humidityPct,
    soil_1_raw:    reading.soil1Raw,
    soil_1_pct:    reading.soil1Pct,
    soil_2_raw:    reading.soil2Raw,
    soil_2_pct:    reading.soil2Pct,
    uptime_ms:     reading.uptimeMs ?? null,
    sd_ok:         reading.sdOk ?? null,
    timestamp:     new Date(reading.timestamp).toISOString(),
    source:        reading.source,
  });
};

const canSync = (): boolean =>
  Boolean(firebaseConfigured && db && navigator.onLine);

// ── Public service ────────────────────────────────────────────────────────────
export const firebaseService = {
  isEnabled(): boolean {
    return firebaseConfigured;
  },

  isLocalOnly(): boolean {
    return !firebaseConfigured;
  },

  async logReading(reading: SensorReading): Promise<{ synced: boolean }> {
    const r = normalize(reading);
    upsertLocal(r);

    if (!canSync()) {
      const q = readPending();
      q.push(r);
      writePending(q);
      return { synced: false };
    }

    try {
      await writeRemote(r);
      return { synced: true };
    } catch (err) {
      console.error("[Firebase] Write failed:", err);
      const q = readPending();
      q.push(r);
      writePending(q);
      return { synced: false };
    }
  },

  async logReadingLocalOnly(reading: SensorReading): Promise<{ synced: boolean }> {
    upsertLocal(normalize(reading));
    return { synced: false };
  },

  async flushPending(): Promise<{ synced: number; failed: number }> {
    if (!canSync()) return { synced: 0, failed: readPending().length };

    const queue = readPending();
    if (!queue.length) return { synced: 0, failed: 0 };

    const failed: SensorReading[] = [];
    let synced = 0;

    for (const item of queue) {
      try {
        await writeRemote(item);
        synced++;
      } catch {
        failed.push(item);
      }
    }

    writePending(failed);
    return { synced, failed: failed.length };
  },

  async getReadingsRange(options: {
    startTs: number;
    endTs: number;
    deviceId?: string;
    maxRows?: number;
  }): Promise<SensorReading[]> {
    const { startTs, endTs, deviceId, maxRows = 500 } = options;

    if (canSync()) {
      try {
        const readingsRef = ref(db!, "readings");
        const q = query(readingsRef, orderByChild("timestamp"), limitToLast(maxRows));
        const snapshot = await get(q);

        if (snapshot.exists()) {
          const remote: SensorReading[] = [];
          snapshot.forEach((child) => {
            const d = child.val();
            const ts = new Date(d.timestamp as string).getTime();
            if (ts >= startTs && ts <= endTs) {
              remote.push({
                id:            child.key ?? crypto.randomUUID(),
                timestamp:     ts,
                deviceId:      d.device_id ?? "esp32-greenhouse-1",
                source:        "ble",
                temperatureC:  d.temperature_c,
                humidityPct:   d.humidity_pct,
                soil1Raw:      d.soil_1_raw,
                soil1Pct:      d.soil_1_pct,
                soil2Raw:      d.soil_2_raw,
                soil2Pct:      d.soil_2_pct,
                uptimeMs:      d.uptime_ms,
                sdOk:          d.sd_ok,
              });
            }
          });

          const merged = dedupeSort([...remote, ...readLocal()]).filter(
            (r) => r.timestamp >= startTs && r.timestamp <= endTs
          );
          writeLocal(merged);
          return merged;
        }
      } catch (err) {
        console.error("[Firebase] getReadingsRange failed:", err);
      }
    }

    return dedupeSort(readLocal())
      .filter((r) => {
        if (deviceId && r.deviceId !== deviceId) return false;
        return r.timestamp >= startTs && r.timestamp <= endTs;
      })
      .slice(0, maxRows);
  },

  async getDailyAggregates(options: {
    startDay: string;
    endDay: string;
    deviceId: string;
  }): Promise<DailyAggregate[]> {
    const startTs = new Date(`${options.startDay}T00:00:00`).getTime();
    const endTs   = new Date(`${options.endDay}T23:59:59`).getTime();

    const readings = dedupeSort(readLocal()).filter(
      (r) =>
        r.deviceId === options.deviceId &&
        r.timestamp >= startTs &&
        r.timestamp <= endTs
    );

    return aggregateByDay(readings);
  },
};

// Ensure session ID exists
if (!storage.get<string | null>(LOCAL_SESSION_KEY, null)) {
  storage.set(LOCAL_SESSION_KEY, crypto.randomUUID());
}