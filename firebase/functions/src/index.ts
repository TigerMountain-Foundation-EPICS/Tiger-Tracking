import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

const validateReading = (value: Record<string, unknown>) => {
  const temperatureC = Number(value.temperatureC);
  const humidityPct = Number(value.humidityPct);
  const soilPct = Number(value.soilPct);
  const timestamp = Number(value.timestamp);

  return {
    ok:
      Number.isFinite(temperatureC) &&
      temperatureC > -40 &&
      temperatureC < 100 &&
      Number.isFinite(humidityPct) &&
      humidityPct >= 0 &&
      humidityPct <= 100 &&
      Number.isFinite(soilPct) &&
      soilPct >= 0 &&
      soilPct <= 100 &&
      Number.isFinite(timestamp) &&
      timestamp > 0,
    temperatureC,
    humidityPct,
    soilPct,
    timestamp
  };
};

export const validateAndWriteReading = onCall(async (request) => {
  if (!request.auth) {
    throw new Error("Authentication required.");
  }

  const data = request.data as Record<string, unknown>;
  const deviceId = String(data.deviceId ?? "");
  const readingId = String(data.id ?? "");

  if (!deviceId || !readingId) {
    throw new Error("deviceId and id are required.");
  }

  const validated = validateReading(data);
  if (!validated.ok) {
    throw new Error("Invalid reading payload.");
  }

  await db.doc(`devices/${deviceId}/readings/${readingId}`).set({
    ...data,
    validatedByFunction: true,
    createdAt: Date.now(),
    uid: request.auth.uid
  });

  return { ok: true };
});

export const onReadingCreated = onDocumentCreated(
  "devices/{deviceId}/readings/{readingId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      return;
    }

    const deviceId = event.params.deviceId as string;
    const validated = validateReading(data as Record<string, unknown>);

    if (!validated.ok) {
      logger.warn("Rejected invalid reading", { deviceId, readingId: event.params.readingId });
      return;
    }

    const day = new Date(validated.timestamp).toISOString().slice(0, 10);
    const aggregateRef = db.doc(`devices/${deviceId}/aggregates/${day}`);

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(aggregateRef);
      const current = snapshot.exists
        ? (snapshot.data() as {
            count: number;
            sumTemperatureC: number;
            sumHumidityPct: number;
            sumSoilPct: number;
            minTemperatureC: number;
            maxTemperatureC: number;
            minHumidityPct: number;
            maxHumidityPct: number;
            minSoilPct: number;
            maxSoilPct: number;
          })
        : null;

      const count = (current?.count ?? 0) + 1;
      const sumTemperatureC = (current?.sumTemperatureC ?? 0) + validated.temperatureC;
      const sumHumidityPct = (current?.sumHumidityPct ?? 0) + validated.humidityPct;
      const sumSoilPct = (current?.sumSoilPct ?? 0) + validated.soilPct;

      const payload = {
        day,
        deviceId,
        count,
        sumTemperatureC,
        sumHumidityPct,
        sumSoilPct,
        minTemperatureC: Math.min(current?.minTemperatureC ?? validated.temperatureC, validated.temperatureC),
        maxTemperatureC: Math.max(current?.maxTemperatureC ?? validated.temperatureC, validated.temperatureC),
        minHumidityPct: Math.min(current?.minHumidityPct ?? validated.humidityPct, validated.humidityPct),
        maxHumidityPct: Math.max(current?.maxHumidityPct ?? validated.humidityPct, validated.humidityPct),
        minSoilPct: Math.min(current?.minSoilPct ?? validated.soilPct, validated.soilPct),
        maxSoilPct: Math.max(current?.maxSoilPct ?? validated.soilPct, validated.soilPct),
        avgTemperatureC: sumTemperatureC / count,
        avgHumidityPct: sumHumidityPct / count,
        avgSoilPct: sumSoilPct / count,
        updatedAt: Date.now()
      };

      transaction.set(aggregateRef, payload, { merge: true });

      const alertsRef = db.collection(`devices/${deviceId}/alerts`).doc();
      if (validated.temperatureC >= 35 || validated.soilPct <= 15) {
        transaction.set(alertsRef, {
          deviceId,
          readingId: event.params.readingId,
          day,
          createdAt: Date.now(),
          type: validated.temperatureC >= 35 ? "TEMP_HIGH" : "SOIL_LOW",
          message:
            validated.temperatureC >= 35
              ? `Temperature high: ${validated.temperatureC.toFixed(1)}C`
              : `Soil moisture low: ${validated.soilPct.toFixed(1)}%`
        });
      }
    });
  }
);
//hi shrehan
