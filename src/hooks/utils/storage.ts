const safeParse = <T>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const storage = {
  get<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") {
      return fallback;
    }
    return safeParse(window.localStorage.getItem(key), fallback);
  },
  set<T>(key: string, value: T): void {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key: string): void {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(key);
  }
};
