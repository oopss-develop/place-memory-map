"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, atMinute, calendarMs, daySegments, shiftSchedule, snapMinutes, tripDates } from "@/lib/timetable";
import type { ScheduleItem, Trip } from "@/types/domain";

const SCALE = 1.2;
type Mode = "create" | "move" | "start" | "end";
type Gesture = { mode: Mode; day: string; startMinute: number; y: number; item?: ScheduleItem; moved: boolean };
export function TimetableGrid({ trip, items, date, selectedId, active, disabled, onDate, onSelect, onCreate, onChange }: {
  trip: Trip; items: ScheduleItem[]; date: string; selectedId?: string; active: boolean; disabled: boolean;
  onDate: (date: string) => void; onSelect: (item: ScheduleItem) => void;
  onCreate: (startsAt: string, endsAt: string) => void; onChange: (item: ScheduleItem) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const [preview, setPreview] = useState<{ day: string; start: number; end: number }>();
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 8 * 60 * SCALE; return () => cleanup.current?.(); }, [trip.id]);
  useEffect(() => {
    if (!selectedId) return;
    const frame = requestAnimationFrame(() => scroll.current?.querySelector<HTMLElement>(`[data-schedule-id="${selectedId}"][data-day="${date}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [selectedId, date, active]);

  function begin(x: number, y: number, day: string, mode: Mode, item: ScheduleItem | undefined, touch: boolean) {
    if (disabled) return;
    cleanup.current?.();
    const column = scroll.current?.querySelector<HTMLElement>(`[data-column-day="${day}"]`);
    if (!column) return;
    const minute = Math.max(0, Math.min(1425, snapMinutes((y - column.getBoundingClientRect().top) / SCALE)));
    const gesture: Gesture = { mode, day, startMinute: minute, y, item, moved: false };
    let active = !touch;
    let currentDay = day;
    let currentMinute = minute;
    let nextItem = item;
    let cancelled = false;
    const timer = window.setTimeout(() => { active = true; if (mode === "create") setPreview({ day, start: minute, end: minute + 15 }); }, touch ? 400 : 0);
    function move(clientX: number, clientY: number) {
      if (!active) {
        if (Math.abs(clientX - x) + Math.abs(clientY - y) > 10) stop();
        return;
      }
      const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-column-day]");
      currentDay = mode === "create" ? day : target?.dataset.columnDay ?? day;
      const rect = (target ?? column)!.getBoundingClientRect();
      currentMinute = Math.max(0, Math.min(1440, snapMinutes((clientY - rect.top) / SCALE)));
      if (Math.abs(clientY - y) > 4 || currentDay !== day) gesture.moved = true;
      if (mode === "create") {
        setPreview({ day, start: Math.min(minute, Math.min(currentMinute, 1425)), end: Math.max(minute + 15, currentMinute) });
      } else if (item) {
        const delta = (calendarMs(`${currentDay}T00:00`) - calendarMs(`${day}T00:00`)) / 60000 + currentMinute - minute;
        nextItem = shiftSchedule(item, mode, delta);
        const segments = daySegments([nextItem], currentDay);
        if (segments[0]) setPreview({ day: currentDay, start: segments[0].start, end: segments[0].end });
      }
      if (scroll.current) {
        const viewport = scroll.current.getBoundingClientRect();
        if (clientY > viewport.bottom - 35) scroll.current.scrollTop += 18;
        if (clientY < viewport.top + 35) scroll.current.scrollTop -= 18;
      }
    }
    function finish() {
      const wasActive = active;
      stop();
      if (cancelled) return;
      if (!wasActive) { if (item) onSelect(item); return; }
      if (mode === "create") {
        onDate(day);
        onCreate(atMinute(day, Math.min(minute, Math.min(currentMinute, 1425))), atMinute(day, Math.max(minute + 15, currentMinute)));
      } else if (gesture.moved && nextItem) { onChange(nextItem); }
      else if (item) onSelect(item);
    }
    const pointerMove = (event: PointerEvent) => move(event.clientX, event.clientY);
    const touchMove = (event: TouchEvent) => { if (active) event.preventDefault(); const point = event.touches[0]; if (point) move(point.clientX, point.clientY); };
    const cancel = () => { cancelled = true; stop(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
    function stop() {
      clearTimeout(timer); setPreview(undefined);
      window.removeEventListener("pointermove", pointerMove); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("touchmove", touchMove); window.removeEventListener("touchend", finish); window.removeEventListener("touchcancel", cancel);
      window.removeEventListener("keydown", key); cleanup.current = null;
    }
    if (touch) {
      window.addEventListener("touchmove", touchMove, { passive: false }); window.addEventListener("touchend", finish); window.addEventListener("touchcancel", cancel);
    } else {
      window.addEventListener("pointermove", pointerMove); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", cancel);
    }
    window.addEventListener("keydown", key); cleanup.current = stop;
  }
  const bindings = (day: string, mode: Mode, item?: ScheduleItem) => ({
    onPointerDown: (event: React.PointerEvent) => { if (event.pointerType === "touch" || event.button !== 0) return; event.preventDefault(); event.stopPropagation(); begin(event.clientX, event.clientY, day, mode, item, false); },
    onTouchStart: (event: React.TouchEvent) => { event.stopPropagation(); const point = event.touches[0]; begin(point.clientX, point.clientY, day, mode, item, true); },
  });
  return <div className="timetable-scroll" ref={scroll} aria-label="여행 시간표">
    <div className="timetable-days">
      <div className="timetable-hours"><div className="timetable-day-heading">시간</div>{Array.from({ length: 24 }, (_, hour) => <span key={hour} style={{ top: 44 + hour * 60 * SCALE }}>{String(hour).padStart(2, "0")}:00</span>)}</div>
      {tripDates(trip).map((day) => <div key={day} className={`timetable-day ${day === date ? "current" : ""}`}>
        <button className="timetable-day-heading" aria-pressed={day === date} onClick={() => onDate(day)}>{day.slice(5).replace("-", "/")} <small>{new Intl.DateTimeFormat("ko", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00Z`))}</small></button>
        <div className="timetable-column" data-column-day={day} style={{ height: 1440 * SCALE }} {...bindings(day, "create")}>
          {Array.from({ length: 24 }, (_, hour) => <div className="timetable-hour-rule" key={hour} style={{ top: hour * 60 * SCALE }} />)}
          {daySegments(items, day).map((segment) => <div key={segment.item.id} data-schedule-id={segment.item.id} data-day={day} className={`schedule-block ${segment.end - segment.start < 30 ? "compact" : ""} ${selectedId === segment.item.id ? "selected" : ""}`} style={{ top: segment.start * SCALE, height: (segment.end - segment.start) * SCALE, left: `calc(${segment.lane / segment.lanes * 100}% + 2px)`, width: `calc(${100 / segment.lanes}% - 4px)` }}>
            <button className="schedule-resize start" aria-label={`${segment.item.title} 시작 시간 조절`} {...bindings(day, "start", segment.item)} onClick={() => onSelect(segment.item)} />
            <button className="schedule-block-body" {...bindings(day, "move", segment.item)} onClick={(event) => { if (event.detail === 0) onSelect(segment.item); }} aria-label={`${segment.order}. ${segment.item.title} ${segment.item.startsAt.slice(11)}부터 ${segment.item.endsAt.slice(11)}까지${segment.lanes > 1 ? ", 다른 일정과 겹침" : ""}`}>
              <strong>{segment.order}. {segment.item.title}</strong><span>{segment.item.startsAt.slice(11)}–{segment.item.endsAt.slice(11)}{segment.item.endsAt.slice(0, 10) === addDays(day, 1) ? " (+1일)" : ""}</span><small>{segment.item.place.name}</small>{segment.lanes > 1 && <small>시간 겹침</small>}
            </button>
            <button className="schedule-resize end" aria-label={`${segment.item.title} 종료 시간 조절`} {...bindings(day, "end", segment.item)} onClick={() => onSelect(segment.item)} />
          </div>)}
          {preview?.day === day && <div className="schedule-preview" style={{ top: preview.start * SCALE, height: Math.max(15, preview.end - preview.start) * SCALE }} aria-hidden="true">{atMinute(day, preview.start).slice(11)}–{atMinute(day, preview.end).slice(11)}</div>}
        </div>
      </div>)}
    </div>
  </div>;
}
