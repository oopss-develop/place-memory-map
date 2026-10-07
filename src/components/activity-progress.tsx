"use client";
import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode, type CSSProperties } from "react";
import { Progress } from "./ui/progress";

const ProgressContext = createContext<((id: string, label?: string) => void) | null>(null);
export function ActivityProgressProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState(false);
  const [colors, setColors] = useState<CSSProperties>();
  const busy = Object.keys(sources).length > 0;
  const update = useCallback((id: string, label?: string) => setSources(previous => {
    if (label === previous[id]) return previous;
    const next = { ...previous };
    if (label) next[id] = label; else delete next[id];
    return next;
  }), []);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (busy) {
        const activeScreen = Array.from(document.querySelectorAll(".journal-app")).find(screen => screen.getClientRects().length > 0);
        const theme = getComputedStyle(activeScreen ?? document.documentElement);
        setColors({ "--progress-color": theme.getPropertyValue("--primary"), "--progress-track": theme.getPropertyValue("--muted") } as CSSProperties);
      }
      setVisible(busy);
    }, busy ? 120 : 0);
    return () => clearTimeout(timer);
  }, [busy]);
  return <ProgressContext.Provider value={update}>{visible && <Progress className="app-activity-progress" style={colors} label={Object.values(sources).at(-1) ?? "처리 중"} />}{children}</ProgressContext.Provider>;
}
export function useActivityProgress(active: boolean, label = "불러오는 중") {
  const update = useContext(ProgressContext), id = useId();
  useEffect(() => { if (active) update?.(id, label); return () => update?.(id); }, [active, id, label, update]);
}
export function LoadingActivity() {
  useActivityProgress(true, "화면 불러오는 중");
  return null;
}
