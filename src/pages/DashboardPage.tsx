import { Activity, ArrowRight, CloudOff, Droplets, Leaf, Waves } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useConnectionState } from "../hooks/useConnectionState";
import { useSettings } from "../hooks/useSettings";
import { formatPercent, formatTempLabel, formatTimestamp } from "../utils/format";

const describeLevel = (value: number, lowThreshold: number, highThreshold: number, lowLabel: string, highLabel: string) => {
  if (value <= lowThreshold) {
    return lowLabel;
  }

  if (value >= highThreshold) {
    return highLabel;
  }

  return "Optimal Moisture";
};

export const DashboardPage = () => {
  const { snapshot, latestReading, readings, localOnly } = useConnectionState();
  const { settings } = useSettings();

  if (!latestReading) {
    return (
      <EmptyState
        title="Waiting for sensor data"
        description="Connect a BLE device or keep Demo Mode enabled to populate the dashboard."
      />
    );
  }

  const temperatureState =
    latestReading.temperatureC >= settings.thresholds.temperatureHighC ? "Warm Watch" : "Stable Climate";
  const humidityState = describeLevel(
    latestReading.humidityPct,
    settings.thresholds.humidityLowPct,
    72,
    "Needs Mist",
    "High Humidity"
  );
  const soilState = describeLevel(
    latestReading.soilPct,
    settings.thresholds.soilLowPct,
    75,
    "Low Moisture",
    "High Moisture"
  );
  const irrigationSuggestion =
    latestReading.soilPct <= settings.thresholds.soilLowPct
      ? "Soil moisture is below the target range. Increase watering and inspect the line before the next cycle."
      : latestReading.soilPct >= 75
        ? "Root zone is already saturated. Hold watering today and let the bed drain naturally."
        : "Moisture is in range. Maintain the current watering rhythm and keep watching the next packet window.";

  const overviewCards = [
    {
      eyebrow: "Plant 01",
      title: "Temperature",
      value: formatTempLabel(latestReading.temperatureC, settings.units),
      status: temperatureState,
      detail: `Last packet ${formatTimestamp(snapshot.lastPacketAt)}`,
      to: "/live",
      action: "View Live Stream",
      accent: "bg-brand-olive/20 text-brand-olive"
    },
    {
      eyebrow: "Plant 02",
      title: "Humidity",
      value: formatPercent(latestReading.humidityPct),
      status: humidityState,
      detail: `Alert floor ${settings.thresholds.humidityLowPct}%`,
      to: "/history",
      action: "View Weekly Log",
      accent: "bg-brand-olive/20 text-brand-olive"
    },
    {
      eyebrow: "Plant 03",
      title: "Soil Moisture",
      value: formatPercent(latestReading.soilPct),
      status: soilState,
      detail: `Raw sensor ${Math.round(latestReading.soilRawOrPct)}`,
      to: "/device",
      action: "Sensor Details",
      accent: "bg-brand-olive/20 text-brand-olive"
    }
  ];

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-3">
        {overviewCards.map((card) => (
          <Card key={card.title} className="space-y-4">
            <div>
              <p className="text-xl font-extrabold text-brand-navy">{card.eyebrow}</p>
              <p className="mt-1 text-base text-slate-500">{card.title}</p>
            </div>
            <div className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${card.accent}`}>
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

      <section className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
        <Card>
          <h2 className="mt-2 text-3xl text-brand-orange">Quick Health</h2>
          <div className="mt-5 grid gap-3 text-sm">
            <p className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-orange" /> Last packet: {formatTimestamp(snapshot.lastPacketAt)}
            </p>
            <p className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-brand-sage" /> Humidity threshold: {settings.thresholds.humidityLowPct}%
            </p>
            <p className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-brand-olive" /> Soil alert threshold: {settings.thresholds.soilLowPct}%
            </p>
            <p className="flex items-center gap-2">
              <CloudOff className="h-4 w-4 text-brand-orange" />
              {localOnly ? "Local-first mode active" : "Firebase sync active"}
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden bg-brand-navy">
          <div className="flex items-start gap-3">
            <div>
              <h2 className="mt-2 text-3xl text-brand-orange">Water Suggestion</h2>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-white/76">{irrigationSuggestion}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] bg-white/10 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/56">Source</p>
              <p className="mt-2 text-lg font-bold capitalize text-navy">{latestReading.source}</p>
            </div>
            <div className="rounded-[22px] bg-white/10 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/56">Updated</p>
              <p className="mt-2 text-lg font-bold text-navy">{formatTimestamp(latestReading.timestamp)}</p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};
