"use client";
import { useEffect, useState } from "react";
import { usePanelSize } from "./panel-divider";
import { WorkspacePicker } from "./workspace-picker";
import { Button } from "./ui/button";

const PRESETS = [{ value: "map", label: "지도 넓게", width: 35 }, { value: "balanced", label: "균형", width: 52 }, { value: "time", label: "시간표 넓게", width: 65 }];
export function useTravelLayout(userId: string) {
  const key = `place-memory-panel-v1:${userId}`;
  const [timeWidth, setTimeWidth] = usePanelSize(key + ":time-width", 52);
  const [mapHeight, setMapHeight] = usePanelSize(key + ":map-height", 62);
  const [preset, setPreset] = useState("balanced");
  useEffect(() => { const timer = setTimeout(() => { try { const saved = localStorage.getItem(key + ":preset"); setPreset(saved && ["map", "balanced", "time", "custom"].includes(saved) ? saved : Number(localStorage.getItem(key + ":time-width") ?? 52) === 52 ? "balanced" : "custom"); } catch { /* Defaults remain usable. */ } }, 0); return () => clearTimeout(timer); }, [key]);
  function remember(value: string) { setPreset(value); try { localStorage.setItem(key + ":preset", value); } catch { /* Storage is optional. */ } }
  return {
    timeWidth, mapHeight, preset,
    resizeWidth(value: number) { setTimeWidth(value); remember("custom"); },
    resizeHeight(value: number) { setMapHeight(value); remember("custom"); },
    select(value: string) { const option = PRESETS.find(option => option.value === value); if (option) { setTimeWidth(option.width); remember(value); } },
    reset() { setTimeWidth(52); setMapHeight(62); remember("balanced"); },
  };
}
export function TravelLayoutControl({ layout }: { layout: ReturnType<typeof useTravelLayout> }) {
  return <div className="travel-layout-control"><WorkspacePicker label="화면 배치" value={layout.preset} searchable={false} options={[...PRESETS, ...(layout.preset === "custom" ? [{ value: "custom", label: "직접 조절" }] : [])]} onChange={layout.select} /><Button variant="ghost" onClick={layout.reset}>크기 초기화</Button></div>;
}
