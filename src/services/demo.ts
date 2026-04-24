import { DailyAggregate, SensorReading } from "../types";
import { clamp } from "../hooks/utils/math";

export const DEFAULT_DEMO_DEVICE_ID = "demo-esp32";

const random = (min: number, max: number): number => Math.random() * (max - min) + min;

interface DemoGeneratorOptions {
  intervalMs?: number;
  deviceId?: string;
  connected?: boolean;
  onReading: (reading: SensorReading) => void;
}

export class DemoDataGenerator {
  private timer: number | null = null;
  private temperatureC = 24.2;
  private humidityPct = 52;
  private soil1Raw = 1900;
  private soil2Raw = 2100;
  private phase = 0;

  start(options: DemoGeneratorOptions): void {
    this.stop();
    const interval = options.intervalMs ?? 2200;
    const deviceId = options.deviceId ?? DEFAULT_DEMO_DEVICE_ID;

    this.timer = window.setInterval(() => {
      this.phase += 0.17;
      const circadian = Math.sin(this.phase) * 0.15;

      this.temperatureC = clamp(this.temperatureC + random(-0.16, 0.16) + circadian, 18, 34);
      this.humidityPct  = clamp(this.humidityPct  + random(-0.9, 0.9) - circadian * 6, 25, 84);
      this.soil1Raw     = clamp(this.soil1Raw + random(-35, 26), 1100, 3400);
      this.soil2Raw     = clamp(this.soil2Raw + random(-35, 26), 1100, 3400);

      // Mirror the ESP32 calibration: wet=1400, dry=3200
      const toSoilPct = (raw: number) => {
        const pct = ((3200 - raw) / (3200 - 1400)) * 100;
        return Number(clamp(pct, 0, 100).toFixed(2));
      };

      const reading: SensorReading = {
        id:           crypto.randomUUID(),
        timestamp:    Date.now(),
        deviceId,
        source:       "demo",
        temperatureC: Number(this.temperatureC.toFixed(2)),
        humidityPct:  Number(this.humidityPct.toFixed(2)),
        soil1Raw:     Math.round(this.soil1Raw),
        soil1Pct:     toSoilPct(this.soil1Raw),
        soil2Raw:     Math.round(this.soil2Raw),
        soil2Pct:     toSoilPct(this.soil2Raw),
        sdOk:         true,
      };

      options.onReading(reading);
    }, interval);
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const createDemoHistory = (
  days: number,
  deviceId = DEFAULT_DEMO_DEVICE_ID
): SensorReading[] => {
  const pointsPerDay = 48;
  const total        = Math.max(1, Math.floor(days * pointsPerDay));
  const now          = Date.now();
  const start        = now - days * 24 * 60 * 60 * 1000;

  const readings: SensorReading[] = [];
  let temperature = 23.8;
  let humidity    = 50;
  let soil1Raw    = 1800;
  let soil2Raw    = 2000;

  const toSoilPct = (raw: number) => {
    const pct = ((3200 - raw) / (3200 - 1400)) * 100;
    return Number(clamp(pct, 0, 100).toFixed(2));
  };

  for (let i = 0; i < total; i++) {
    const timestamp = start + (i / total) * (now - start);
    const cycle     = Math.sin(i / 8) * 0.2;

    temperature = clamp(temperature + random(-0.19, 0.19) + cycle, 17, 35);
    humidity    = clamp(humidity    + random(-1.2, 1.2) - cycle * 4, 20, 88);
    soil1Raw    = clamp(soil1Raw    + random(-30, 24), 1050, 3480);
    soil2Raw    = clamp(soil2Raw    + random(-30, 24), 1050, 3480);

    readings.push({
      id:           `demo-h-${i}`,
      timestamp,
      deviceId,
      source:       "demo",
      temperatureC: Number(temperature.toFixed(2)),
      humidityPct:  Number(humidity.toFixed(2)),
      soil1Raw:     Math.round(soil1Raw),
      soil1Pct:     toSoilPct(soil1Raw),
      soil2Raw:     Math.round(soil2Raw),
      soil2Pct:     toSoilPct(soil2Raw),
      sdOk:         true,
    });
  }

  return readings;
};

export const aggregateByDay = (readings: SensorReading[]): DailyAggregate[] => {
  const buckets = new Map<string, SensorReading[]>();

  readings.forEach((r) => {
    const day   = new Date(r.timestamp).toISOString().slice(0, 10);
    const group = buckets.get(day) ?? [];
    group.push(r);
    buckets.set(day, group);
  });

  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, group]) => {
      const count    = group.length;
      const temps    = group.map((r) => r.temperatureC);
      const humidity = group.map((r) => r.humidityPct);
      const soil1    = group.map((r) => r.soil1Pct);
      const soil2    = group.map((r) => r.soil2Pct);
      const sum      = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

      return {
        id:             `${group[0].deviceId}-${day}`,
        day,
        deviceId:       group[0].deviceId,
        count,
        minTemperatureC: Math.min(...temps),
        maxTemperatureC: Math.max(...temps),
        avgTemperatureC: sum(temps) / count,
        minHumidityPct:  Math.min(...humidity),
        maxHumidityPct:  Math.max(...humidity),
        avgHumidityPct:  sum(humidity) / count,
        minSoil1Pct:     Math.min(...soil1),
        maxSoil1Pct:     Math.max(...soil1),
        avgSoil1Pct:     sum(soil1) / count,
        minSoil2Pct:     Math.min(...soil2),
        maxSoil2Pct:     Math.max(...soil2),
        avgSoil2Pct:     sum(soil2) / count,
      };
    });
};