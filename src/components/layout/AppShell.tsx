import { Bluetooth, Gauge, History, LayoutDashboard, Settings, Users } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useConnectionState } from "../../hooks/useConnectionState";
import { StatusPill } from "../ui/StatusPill";

const tabs = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/live", label: "Live", icon: Gauge },
  { to: "/history", label: "Weekly", icon: History },
  { to: "/device", label: "Sensor", icon: Bluetooth },
  { to: "/settings", label: "Profile", icon: Settings }
];

const routeMeta: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "Garden Overview",
    subtitle: "A field-ready view of moisture, climate, and sensor status."
  },
  "/live": {
    title: "Live Stream",
    subtitle: "Track the current soil and climate pulse from the sensor feed."
  },
  "/history": {
    title: "Weekly Report",
    subtitle: "Review historical ranges, daily aggregates, and recent logs."
  },
  "/device": {
    title: "Sensor Pairing",
    subtitle: "Connect hardware, tune calibration, and monitor connection health."
  },
  "/crowd": {
    title: "Crowd Vision",
    subtitle: "Run local ONNX detection while keeping the same field UI language."
  },
  "/settings": {
    title: "Profile & Settings",
    subtitle: "Manage demo mode, thresholds, and Firebase access in one place."
  },
  "/test-run": {
    title: "Preview Data",
    subtitle: "A deterministic sample run to validate the redesigned dashboard."
  }
};

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { snapshot, localOnly } = useConnectionState();
  const location = useLocation();
  const meta = routeMeta[location.pathname] ?? routeMeta["/"];

  return (
    <div className="min-h-screen bg-surface text-brand-navy">
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-32 pt-4 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[34px] bg-brand-navy px-5 py-5 text-white shadow-shell sm:px-7 sm:py-6">
          <div className="relative">
            <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-brand-orange/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-brand-sage/20 blur-3xl" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-extrabold tracking-[0.18em] text-brand-orange">TigerMountain Foundation</p>
                <h1 className="mt-2 text-[2.4rem] leading-none text-white sm:text-[2.8rem]">Tiger Tracking</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/72">{meta.subtitle}</p>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                {localOnly && (
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/80">
                    Local Only
                  </span>
                )}
                <StatusPill status={snapshot.status} />
              </div>
            </div>
            <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[28px] bg-white/10 px-4 py-4 backdrop-blur">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/58">Current Screen</p>
                <p className="mt-1 text-xl font-extrabold text-white">{meta.title}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/58">Active Device</p>
                <p className="mt-1 text-sm font-bold text-white">{snapshot.device?.name ?? "Demo ESP32"}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="relative flex-1 pb-4 pt-6">{children}</main>

        <nav
          className="fixed bottom-5 left-1/2 z-20 flex w-[min(calc(100%-1.5rem),48rem)] -translate-x-1/2 gap-1 rounded-[30px] bg-brand-navy px-2 py-2 shadow-shell backdrop-blur"
          aria-label="Main tabs"
        >
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[24px] px-2 py-2 text-[11px] font-extrabold tracking-[0.04em] transition ${
                  isActive
                    ? "bg-white text-brand-navy shadow-float"
                    : "text-white/100 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};
