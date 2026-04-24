export const formatTimestamp = (timestamp?: number | null): string => {
  if (!timestamp) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
};

export const formatDateOnly = (value: string | number): string => {
  const date = typeof value === "number" ? new Date(value) : new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

export const toDisplayTemp = (temperatureC: number, units: "C" | "F"): number =>
  units === "C" ? temperatureC : (temperatureC * 9) / 5 + 32;

export const formatTempLabel = (temperatureC: number, units: "C" | "F"): string => {
  const value = toDisplayTemp(temperatureC, units);
  return `${value.toFixed(1)}°${units}`;
};

export const formatPercent = (value?: number): string => {
  if (value === null || value === undefined || isNaN(value)) return "--%";
  return `${value.toFixed(0)}%`;
};