import { createContext, useContext, useMemo, useState } from "react";
import { AppSettings, SoilCalibration, ThresholdSettings } from "../types";
import { storage } from "./utils/storage";

const SETTINGS_KEY = "sensor.app.settings.v1";

const defaultThresholds: ThresholdSettings = {
  temperatureHighC: 30,
  humidityLowPct: 35,
  soilLowPct: 25
};

const defaultCalibration: SoilCalibration = {
  min: 1200,
  max: 3200
};

const defaultSettings: AppSettings = {
  demoMode: true,
  demoConnected: true,
  units: "C",
  thresholds: defaultThresholds,
  soilCalibration: defaultCalibration,
  firebaseEnabled: import.meta.env.VITE_FIREBASE_ENABLED === "true"
};

interface SettingsContextValue {
  settings: AppSettings;
  setDemoMode: (enabled: boolean) => void;
  setDemoConnected: (enabled: boolean) => void;
  setUnits: (units: "C" | "F") => void;
  setThresholds: (thresholds: ThresholdSettings) => void;
  setSoilCalibration: (calibration: SoilCalibration) => void;
  setFirebaseEnabled: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<AppSettings>(() =>
    storage.get<AppSettings>(SETTINGS_KEY, defaultSettings)
  );

  const patch = (next: Partial<AppSettings>) => {
    setSettings((current) => {
      const merged = { ...current, ...next };
      storage.set(SETTINGS_KEY, merged);
      return merged;
    });
  };

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      setDemoMode: (enabled) => patch({ demoMode: enabled }),
      setDemoConnected: (enabled) => patch({ demoConnected: enabled }),
      setUnits: (units) => patch({ units }),
      setThresholds: (thresholds) => patch({ thresholds }),
      setSoilCalibration: (soilCalibration) => patch({ soilCalibration }),
      setFirebaseEnabled: (firebaseEnabled) => patch({ firebaseEnabled })
    }),
    [settings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider.");
  }
  return context;
};
