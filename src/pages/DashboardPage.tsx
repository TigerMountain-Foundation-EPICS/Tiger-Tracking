import { Activity, CloudOff, Droplets, Leaf, HardDrive, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useConnectionState } from "../hooks/useConnectionState";
import { useSettings } from "../hooks/useSettings";
import { formatPercent, formatTempLabel, formatTimestamp } from "../hooks/utils/format";

const moistureLabel = (pct: number, lowThreshold: number): string => {
  if (pct <= lowThreshold) return "Low Moisture";
  if (pct >= 75) return "Well Saturated";
  return "Optimal Moisture";
};

export const DashboardPage = () => {
  const { snapshot, latestReading, localOnly } = useConnectionState();
  const { settings } = useSettings();

  if (!latestReading) {
    return (
      <EmptyState
        title="Waiting for sensor data"
        description="Connect to ESP32-Greenhouse over BLE or enable Demo Mode to populate the dashboard."
      />
    );
  }

  const temperatureStatus =
    latestReading.temperatureC >= settings.thresholds.temperatureHighC
      ? "Warm Watch"
      : "Stable Climate";

  const humidityStatus =
    latestReading.humidityPct <= settings.thresholds.humidityLowPct
      ? "Needs Mist"
      : latestReading.humidityPct >= 72
        ? "High Humidity"
        : "Good Humidity";

  const soil1Status = moistureLabel(latestReading.soil1Pct, settings.thresholds.soilLowPct);
  const soil2Status = moistureLabel(latestReading.soil2Pct, settings.thresholds.soilLowPct);

  const irrigationSuggestion =
    latestReading.soil1Pct <= settings.thresholds.soilLowPct ||
    latestReading.soil2Pct <= settings.thresholds.soilLowPct
      ? "One or more soil sensors are below the moisture threshold. Consider watering soon."
      : latestReading.soil1Pct >= 75 && latestReading.soil2Pct >= 75
        ? "Both zones are saturated. Hold watering today and let the beds drain naturally."
        : "Moisture levels are in range. Maintain the current watering rhythm.";

  const overviewCards = [
    {
      eyebrow: "SHT31 Sensor",
      title: "Temperature",
      value: formatTempLabel(latestReading.temperatureC, settings.units),
      status: temperatureStatus,
      detail: `Last packet ${formatTimestamp(snapshot.lastPacketAt)}`,
      to: "/live",
      action: "View Live Stream",
    },
    {
      eyebrow: "SHT31 Sensor",
      title: "Humidity",
      value: formatPercent(latestReading.humidityPct),
      status: humidityStatus,
      detail: `Alert floor ${settings.thresholds.humidityLowPct}%`,
      to: "/history",
      action: "View Weekly Log",
    },
    {
      eyebrow: "Soil Probe 1",
      title: "Soil Moisture",
      value: formatPercent(latestReading.soil1Pct),
      status: soil1Status,
      detail: `Raw ADC ${latestReading.soil1Raw}`,
      to: "/device",
      action: "Sensor Details",
    },
    {
      eyebrow: "Soil Probe 2",
      title: "Soil Moisture",
      value: formatPercent(latestReading.soil2Pct),
      status: soil2Status,
      detail: `Raw ADC ${latestReading.soil2Raw}`,
      to: "/device",
      action: "Sensor Details",
    },
  ];

  return (
    <div className="space-y-4">

      {/* ── Four metric cards ── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <Card key={`${card.eyebrow}-${card.title}`} className="space-y-4">
            <div>
              <p className="text-xl font-extrabold text-brand-navy">{card.eyebrow}</p>
              <p className="mt-1 text-base text-slate-500">{card.title}</p>
            </div>
            <div className="inline-flex rounded-full px-3 py-1 text-xs font-extrabold bg-brand-olive/20 text-brand-olive">
              {card.status}
            </div>
            <div>
              <p className="text-4xl font-extrabold leading-none text-brand-orange">{card.value}</p>
              <p className="mt-3 text-sm text-slate-600">{card.detail}</p>
            </div>
            <Link to={card.to} className="app-link-button w-full">
              {card.action}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Card>
        ))}
      </section>

      {/* ── Health + Irrigation ── */}
      <section className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
        <Card>
          <h2 className="mt-2 text-3xl text-brand-orange">Quick Health</h2>
          <div className="mt-5 grid gap-3 text-sm">
            <p className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-orange" />
              Last packet: {formatTimestamp(snapshot.lastPacketAt)}
            </p>
            <p className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-brand-sage" />
              Humidity threshold: {settings.thresholds.humidityLowPct}%
            </p>
            <p className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-brand-olive" />
              Soil alert threshold: {settings.thresholds.soilLowPct}%
            </p>
            <p className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-brand-sage" />
              SD card logging: {latestReading.sdOk ? "Active" : "Unavailable"}
            </p>
            <p className="flex items-center gap-2">
              <CloudOff className="h-4 w-4 text-brand-orange" />
              {localOnly ? "Local-first mode active" : "Firebase sync active"}
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden bg-brand-navy">
          <p className="eyebrow text-brand-orange">Watering Suggestion</p>
          <h2 className="mt-2 text-3xl text-white">Keep the next cycle intentional</h2>
          <p className="mt-4 text-sm leading-6 text-white/70">{irrigationSuggestion}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] bg-white/10 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/50">Probe 1</p>
              <p className="mt-2 text-lg font-bold text-white">
                {formatPercent(latestReading.soil1Pct)}
              </p>
            </div>
            <div className="rounded-[22px] bg-white/10 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/50">Probe 2</p>
              <p className="mt-2 text-lg font-bold text-white">
                {formatPercent(latestReading.soil2Pct)}
              </p>
            </div>
            <div className="rounded-[22px] bg-white/10 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/50">Source</p>
              <p className="mt-2 text-lg font-bold capitalize text-white">{latestReading.source}</p>
            </div>
            <div className="rounded-[22px] bg-white/10 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/50">Updated</p>
              <p className="mt-2 text-lg font-bold text-white">
                {formatTimestamp(latestReading.timestamp)}
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};