import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { useConnectionState } from "../hooks/useConnectionState";
import { useSettings } from "../hooks/useSettings";
import { formatTempLabel, formatTimestamp, toDisplayTemp } from "../utils/format";
import { movingAverage } from "../utils/math";

export const LivePage = () => {
  const { readings, latestReading, logReading } = useConnectionState();
  const { settings } = useSettings();

  const chartData = useMemo(() => {
    const points   = readings.slice(0, 40).reverse();
    const smoothed = movingAverage(points.map((r) => r.temperatureC), 6);

    return points.map((r, i) => ({
      ts:          new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      temperature: toDisplayTemp(r.temperatureC, settings.units),
      smoothed:    toDisplayTemp(smoothed[i], settings.units),
      humidity:    r.humidityPct,
      soil1:       r.soil1Pct,
      soil2:       r.soil2Pct,
    }));
  }, [readings, settings.units]);

  if (!latestReading) {
    return (
      <EmptyState
        title="No live stream yet"
        description="Connect to BLE or run demo mode to view the real-time stream."
      />
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Soil moisture chart ── */}
      <Card className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Greenhouse Sensors</p>
            <h2 className="mt-2 text-3xl text-brand-navy">Live soil moisture</h2>
            <p className="section-copy mt-2">
              Dual probe history — Probe 1 (teal) and Probe 2 (sage).
            </p>
          </div>
          <Button onClick={() => logReading(latestReading)} variant="secondary">
            Log Reading
          </Button>
        </div>

        <div className="soft-panel">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-sm font-bold text-brand-sage">Probe 1</p>
              <p className="mt-2 text-5xl font-extrabold leading-none text-brand-sage">
                {latestReading.soil1Pct.toFixed(0)}%
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-brand-olive">Probe 2</p>
              <p className="mt-2 text-5xl font-extrabold leading-none text-brand-olive">
                {latestReading.soil2Pct.toFixed(0)}%
              </p>
            </div>
            <div className="text-sm text-slate-500">
              <p>Last updated {formatTimestamp(latestReading.timestamp)}</p>
              <p>Stream window {chartData.length} recent packets</p>
            </div>
          </div>

          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                <XAxis
                  dataKey="ts"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip />
                <Line type="monotone" dataKey="soil1"    stroke="#76a8a2" strokeWidth={3} dot={false} name="Probe 1" />
                <Line type="monotone" dataKey="soil2"    stroke="#6d8d42" strokeWidth={3} dot={false} name="Probe 2" />
                <Line type="monotone" dataKey="humidity" stroke="#cfd9d3" strokeWidth={2} dot={false} name="Humidity" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* ── Current conditions ── */}
      <Card>
        <p className="eyebrow">Current Conditions</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="stat-tile">
            <p className="text-sm text-slate-500">Temperature</p>
            <p className="mt-2 text-3xl font-extrabold text-brand-navy">
              {formatTempLabel(latestReading.temperatureC, settings.units)}
            </p>
          </div>
          <div className="stat-tile">
            <p className="text-sm text-slate-500">Humidity</p>
            <p className="mt-2 text-3xl font-extrabold text-brand-navy">
              {latestReading.humidityPct.toFixed(0)}%
            </p>
          </div>
          <div className="stat-tile">
            <p className="text-sm text-slate-500">Soil Probe 1</p>
            <p className="mt-2 text-3xl font-extrabold text-brand-navy">
              {latestReading.soil1Pct.toFixed(0)}%
            </p>
            <p className="text-xs text-slate-400">Raw {latestReading.soil1Raw}</p>
          </div>
          <div className="stat-tile">
            <p className="text-sm text-slate-500">Soil Probe 2</p>
            <p className="mt-2 text-3xl font-extrabold text-brand-navy">
              {latestReading.soil2Pct.toFixed(0)}%
            </p>
            <p className="text-xs text-slate-400">Raw {latestReading.soil2Raw}</p>
          </div>
        </div>
      </Card>

      {/* ── SD card status ── */}
      {latestReading.sdOk !== undefined && (
        <Card>
          <p className="eyebrow">Device Status</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="stat-tile">
              <p className="text-sm text-slate-500">SD Card Logging</p>
              <p className={`mt-2 text-xl font-extrabold ${latestReading.sdOk ? "text-brand-olive" : "text-brand-orange"}`}>
                {latestReading.sdOk ? "Active" : "Unavailable"}
              </p>
            </div>
            <div className="stat-tile">
              <p className="text-sm text-slate-500">Uptime</p>
              <p className="mt-2 text-xl font-extrabold text-brand-navy">
                {latestReading.uptimeMs !== undefined
                  ? `${Math.floor(latestReading.uptimeMs / 60000)}m ${Math.floor((latestReading.uptimeMs % 60000) / 1000)}s`
                  : "--"}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Recent packets table ── */}
      <Card>
        <p className="eyebrow">Recent Packets</p>
        <div className="mt-3 overflow-x-auto">
          <table className="app-table min-w-[640px]">
            <thead>
              <tr>
                <th>Time</th>
                <th>Temp</th>
                <th>Humidity</th>
                <th>Probe 1</th>
                <th>Probe 2</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {readings.slice(0, 12).map((r) => (
                <tr key={r.id}>
                  <td>{formatTimestamp(r.timestamp)}</td>
                  <td>{formatTempLabel(r.temperatureC, settings.units)}</td>
                  <td>{r.humidityPct.toFixed(1)}%</td>
                  <td>{r.soil1Pct.toFixed(1)}%</td>
                  <td>{r.soil2Pct.toFixed(1)}%</td>
                  <td className="uppercase tracking-[0.16em] text-slate-500">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};