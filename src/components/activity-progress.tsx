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
      setVisible(busy);
    }, busy ? 120 : 0);
    return () => clearTimeout(timer);
  }, [busy]);
  useEffect(() => {
    if (!visible) return;
    const syncColors = () => {
      const activeScreen = Array.from(document.querySelectorAll(".journal-app")).find(screen => screen.getClientRects().length > 0);
      const theme = getComputedStyle(activeScreen ?? document.documentElement);
      const next = { "--progress-color": theme.getPropertyValue("--primary"), "--progress-track": theme.getPropertyValue("--muted") };
      setColors(previous => {
        const current = previous as typeof next | undefined;
        return current?.["--progress-color"] === next["--progress-color"] && current?.["--progress-track"] === next["--progress-track"] ? previous : next as CSSProperties;
      });
    };
    syncColors();
    // The themed screen can change or finish mounting while a request is pending.
    const observer = new MutationObserver(syncColors);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-theme", "class", "style", "hidden"] });
    return () => observer.disconnect();
  }, [visible]);
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
