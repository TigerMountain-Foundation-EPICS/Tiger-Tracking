import { AlertCircle, BluetoothSearching, Smartphone } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useConnectionState } from "../hooks/useConnectionState";
import { useSettings } from "../hooks/useSettings";
import { useToast } from "../hooks/useToast";
import { BLE_NOTIFY_CHARACTERISTIC_UUID, BLE_SERVICE_UUID } from "../services/ble";
import { formatTimestamp } from "../hooks/utils/format";

export const DevicePage = () => {
  const { snapshot, connect, disconnect, reconnect, isBleSupported } = useConnectionState();
  const { settings, setSoilCalibration } = useSettings();
  const { pushToast } = useToast();

  const runDeviceAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Device action failed.", "error");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Sensor Pairing</p>
            <h2 className="mt-2 text-3xl text-brand-navy">Connect to your field sensor</h2>
            <p className="section-copy mt-2">Scan, reconnect, and keep the telemetry stream stable from one control card.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void runDeviceAction(connect)} variant="primary">
              {snapshot.status === "connected" ? "Connected" : "Scan + Connect"}
            </Button>
            <Button
              onClick={() => void runDeviceAction(reconnect)}
              variant="secondary"
              disabled={!settings.demoMode && !snapshot.device}
            >
              Reconnect
            </Button>
            <Button
              onClick={() => void runDeviceAction(disconnect)}
              variant="ghost"
              disabled={snapshot.status !== "connected" && !settings.demoMode}
            >
              Disconnect
            </Button>
          </div>
        </div>

        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div className="stat-tile">
            <span className="block text-xs uppercase tracking-[0.18em] text-slate-500">Device Name</span>
            <span className="mt-2 block text-xl font-extrabold text-brand-navy">
              {snapshot.device?.name ?? "Not connected"}
            </span>
          </div>
          <div className="stat-tile">
            <span className="block text-xs uppercase tracking-[0.18em] text-slate-500">Firmware</span>
            <span className="mt-2 block text-xl font-extrabold text-brand-navy">
              {snapshot.device?.firmwareVersion ?? "Not exposed"}
            </span>
          </div>
          <div className="stat-tile">
            <span className="block text-xs uppercase tracking-[0.18em] text-slate-500">Last Packet</span>
            <span className="mt-2 block text-xl font-extrabold text-brand-navy">{formatTimestamp(snapshot.lastPacketAt)}</span>
          </div>
          <div className="stat-tile">
            <span className="block text-xs uppercase tracking-[0.18em] text-slate-500">Support</span>
            <span className="mt-2 block text-xl font-extrabold text-brand-navy">
              {isBleSupported ? "Web Bluetooth available" : "Web Bluetooth unavailable"}
            </span>
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="eyebrow">Calibration</p>
        <h3 className="text-3xl text-brand-navy">Tune soil mapping</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-2 block text-slate-500">Soil raw min (wet)</span>
            <input
              type="number"
              value={settings.soilCalibration.min}
              onChange={(event) =>
                setSoilCalibration({ ...settings.soilCalibration, min: Number(event.target.value) })
              }
              className="app-input"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block text-slate-500">Soil raw max (dry)</span>
            <input
              type="number"
              value={settings.soilCalibration.max}
              onChange={(event) =>
                setSoilCalibration({ ...settings.soilCalibration, max: Number(event.target.value) })
              }
              className="app-input"
            />
          </label>
        </div>
      </Card>

      <Card className="space-y-3 text-sm">
        <p className="eyebrow">BLE Strategy</p>
        <p className="rounded-[24px] border border-border bg-brand-cream/80 p-4">
          Service UUID: <code>{BLE_SERVICE_UUID}</code>
          <br />
          Notify characteristic: <code>{BLE_NOTIFY_CHARACTERISTIC_UUID}</code>
        </p>
        <p className="flex items-start gap-2 rounded-[24px] border border-border bg-brand-cream/80 p-4">
          <BluetoothSearching className="mt-0.5 h-4 w-4 text-brand-olive" />
          Primary web path uses Web Bluetooth notifications with JSON-first and binary fallback payload parsing.
        </p>
        <p className="flex items-start gap-2 rounded-[24px] border border-border bg-brand-cream/80 p-4">
          <Smartphone className="mt-0.5 h-4 w-4 text-brand-sage" />
          iPhone reliability path: package this app with Capacitor and use `@capacitor-community/bluetooth-le` as a native BLE bridge.
        </p>
        {!isBleSupported && (
          <p className="flex items-start gap-2 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            This browser does not expose Web Bluetooth. Use Demo Mode or a Chromium browser.
          </p>
        )}
      </Card>
    </div>
  );
};
