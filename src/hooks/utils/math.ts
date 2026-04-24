export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const movingAverage = (values: number[], windowSize: number): number[] => {
  if (windowSize <= 1) {
    return values;
  }

  const result: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    const avg = window.reduce((sum, value) => sum + value, 0) / window.length;
    result.push(avg);
  }
  return result;
};

export const average = (values: number[]): number => {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};
