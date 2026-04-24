import { useMemo } from "react";
import { MetricCard } from "../components/MetricCard";
import { Card } from "../components/ui/Card";
import { createDemoHistory } from "../services/demo";
import { useSettings } from "../hooks/useSettings";
import { formatTempLabel } from "../hooks/utils/format";

export const TestRunPage = () => {
  const { settings } = useSettings();

  const sample = useMemo(() => createDemoHistory(2, settings), [settings]);
  const latest = sample[sample.length - 1];

  const tempTrend = sample.slice(-24).map((reading) => reading.temperatureC);
  const humidityTrend = sample.slice(-24).map((reading) => reading.humidityPct);
  const soilTrend = sample.slice(-24).map((reading) => reading.soilPct);

  return (
    <div className="space-y-4">
      <Card>
        <p className="eyebrow">Preview Data</p>
        <h2 className="mt-2 text-3xl text-brand-navy">Test Run</h2>
        <p className="section-copy mt-2">Complete dashboard render with deterministic-looking sample data.</p>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Temperature"
          value={formatTempLabel(latest.temperatureC, settings.units)}
          subtitle="Sample stream"
          trend={tempTrend}
        />
        <MetricCard
          title="Humidity"
          value={`${latest.humidityPct.toFixed(1)}%`}
          subtitle="Sample stream"
          trend={humidityTrend}
        />
        <MetricCard
          title="Soil"
          value={`${latest.soilPct.toFixed(1)}%`}
          subtitle="Sample stream"
          trend={soilTrend}
        />
      </section>

      <Card>
        <p className="eyebrow">Sample Packets</p>
        <div className="mt-3 overflow-x-auto">
          <table className="app-table min-w-[680px]">
            <thead>
              <tr>
                <th>Time</th>
                <th>Temperature</th>
                <th>Humidity</th>
                <th>Soil</th>
              </tr>
            </thead>
            <tbody>
              {sample
                .slice(-20)
                .reverse()
                .map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.timestamp).toLocaleString()}</td>
                    <td>{formatTempLabel(row.temperatureC, settings.units)}</td>
                    <td>{row.humidityPct.toFixed(1)}%</td>
                    <td>{row.soilPct.toFixed(1)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
