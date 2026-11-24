import { useEffect, useState } from "react";
import { effortMedians, metricsEnabled } from "../storage/metrics.ts";
import { useSessionStore } from "./session.tsx";

export function EffortMedian({ level, label }: { level: string; label: string }) {
  const { bank: { version }, settings, slug } = useSessionStore().getState().ctx;
  const show = settings.display.showMedianTimes;
  const measured = show && metricsEnabled;
  const [minutes, setMinutes] = useState<number>();
  useEffect(() => {
    if (!measured) return;
    let mounted = true;
    const refresh = async () => {
      try {
        const rows = await effortMedians(version, slug);
        if (mounted) setMinutes(rows.get(level));
      } catch { /* Keep the latest estimate while offline. */ }
    };
    void refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => { mounted = false; window.clearInterval(interval); };
  }, [level, measured, slug, version]);
  const [name, estimate] = label.split(" · ");
  const duration = minutes === undefined
    ? estimate
    : "Medián " + minutes.toLocaleString("hu-HU", { maximumFractionDigits: 1 }) + " perc";
  return <><span className="block font-semibold">{name}</span>{show && duration && <span className="block text-sm">{duration}</span>}</>;
}
