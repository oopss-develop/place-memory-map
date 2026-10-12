"use client";
import { useEffect, useState } from "react";
import { usePanelSize } from "./panel-divider";
import { Popover } from "radix-ui";
import { SlidersHorizontal, X } from "lucide-react";
import { WorkspacePicker } from "./workspace-picker";
import { Button } from "./ui/button";

const PRESETS = [{ value: "map", label: "지도 넓게", width: 35 }, { value: "balanced", label: "균형", width: 52 }, { value: "time", label: "시간표 넓게", width: 65 }];
export function useTravelLayout(userId: string) {
  const key = `place-memory-panel-v1:${userId}`;
  const [timeWidth, setTimeWidth] = usePanelSize(key + ":time-width", 52);
  const [mapHeight, setMapHeight] = usePanelSize(key + ":map-height", 62);
  const [mapWidth, setMapWidth] = usePanelSize(key + ":map-width", 60);
  const [agendaPosition, setAgendaPosition] = useState<"bottom" | "right">("bottom");
  const [preset, setPreset] = useState("balanced");
  useEffect(() => { const timer = setTimeout(() => { try { setAgendaPosition(localStorage.getItem(key + ":agenda-position") === "right" ? "right" : "bottom"); const saved = localStorage.getItem(key + ":preset"); setPreset(saved && ["map", "balanced", "time", "custom"].includes(saved) ? saved : Number(localStorage.getItem(key + ":time-width") ?? 52) === 52 ? "balanced" : "custom"); } catch { /* Defaults remain usable. */ } }, 0); return () => clearTimeout(timer); }, [key]);
  function remember(value: string) { setPreset(value); try { localStorage.setItem(key + ":preset", value); } catch { /* Storage is optional. */ } }
  return {
    timeWidth, mapHeight, mapWidth, agendaPosition, preset,
    positionAgenda(value: string) { if (value !== "bottom" && value !== "right") return; setAgendaPosition(value); try { localStorage.setItem(key + ":agenda-position", value); } catch { /* Storage is optional. */ } },
    resizeMapWidth(value: number) { setMapWidth(value); remember("custom"); },
    resizeWidth(value: number) { setTimeWidth(value); remember("custom"); },
    resizeHeight(value: number) { setMapHeight(value); remember("custom"); },
    select(value: string) { const option = PRESETS.find(option => option.value === value); if (option) { setTimeWidth(option.width); remember(value); } },
    reset() { setTimeWidth(52); setMapHeight(62); setMapWidth(60); remember("balanced"); },
  };
}
export function TravelLayoutControl({ layout, disabled, agendaOnRight }: { layout: ReturnType<typeof useTravelLayout>; disabled?: boolean; agendaOnRight?: boolean }) {
  return <Popover.Root>
    <Popover.Trigger asChild><Button className="travel-layout-trigger" variant="outline" disabled={disabled}><SlidersHorizontal />보기 설정</Button></Popover.Trigger>
    <Popover.Portal><Popover.Content className="travel-layout-popover" sideOffset={8} align="end" collisionPadding={16} aria-label="보기 설정">
      <div className="travel-layout-popover-heading"><h2>보기 설정</h2><Popover.Close asChild><Button variant="ghost" size="icon" aria-label="보기 설정 닫기"><X /></Button></Popover.Close></div>
      <p>시간표와 지도 영역의 크기를 조절합니다.</p>
      <div className="travel-layout-control"><span>화면 배치</span><WorkspacePicker label="화면 배치" value={layout.preset} searchable={false} options={[...PRESETS, ...(layout.preset === "custom" ? [{ value: "custom", label: "직접 조절" }] : [])]} onChange={layout.select} disabled={disabled} /><span>방문 순서 위치</span><WorkspacePicker label="방문 순서 위치" value={layout.agendaPosition} searchable={false} options={[{ value: "bottom", label: "지도 아래" }, { value: "right", label: "지도 오른쪽" }]} onChange={layout.positionAgenda} disabled={disabled} /><p className="travel-layout-hint" aria-live="polite">{layout.agendaPosition === "right" && !agendaOnRight ? "지도가 좁아 아래에 표시 중이에요. 지도 넓게를 선택하거나 시간표 너비를 줄여주세요." : "지도 영역이 좁으면 목록은 아래에 표시됩니다."}</p><Button variant="outline" onClick={layout.reset} disabled={disabled}>크기 초기화</Button></div>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
