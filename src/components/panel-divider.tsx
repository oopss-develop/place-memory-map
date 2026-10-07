"use client";

import { useEffect, useRef, useState } from "react";

export function usePanelSize(key: string, initial: number) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = Number(localStorage.getItem(key) ?? initial);
        setValue(Number.isFinite(saved) ? Math.max(10, Math.min(90, saved)) : initial);
      } catch { setValue(initial); }
    }, 0);
    return () => clearTimeout(timer);
  }, [key, initial]);
  function update(next: number) {
    setValue(next);
    try { localStorage.setItem(key, String(next)); } catch { /* Layout remains usable without storage. */ }
  }
  return [value, update] as const;
}

export function PanelDivider({ label, axis, value, initial, minBefore, minAfter, onChange }: {
  label: string; axis: "x" | "y"; value: number; initial: number; minBefore: number; minAfter: number; onChange: (value: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ position: number; value: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  function bounds() {
    const rect = ref.current?.parentElement?.getBoundingClientRect();
    const size = Math.max(1, (axis === "x" ? rect?.width : rect?.height) ?? 1);
    return { size, min: Math.min(45, minBefore / size * 100), max: Math.max(55, 100 - minAfter / size * 100) };
  }
  function change(next: number) { const limits = bounds(); onChange(Math.max(limits.min, Math.min(limits.max, next))); }
  function end() { start.current = null; setDragging(false); }
  return <div ref={ref} className={`panel-divider axis-${axis}`} role="separator" tabIndex={0} aria-label={label} aria-orientation={axis === "x" ? "vertical" : "horizontal"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-valuetext={`${Math.round(value)}%`} title={`${label} · 드래그 또는 방향키 · 더블클릭으로 초기화`} data-dragging={dragging}
    onDoubleClick={() => onChange(initial)}
    onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); start.current = { position: axis === "x" ? event.clientX : event.clientY, value }; setDragging(true); }}
    onPointerMove={event => { if (start.current) change(start.current.value + ((axis === "x" ? event.clientX : event.clientY) - start.current.position) / bounds().size * 100); }}
    onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); end(); }}
    onPointerCancel={end} onLostPointerCapture={end}
    onKeyDown={event => {
      const decrease = axis === "x" ? "ArrowLeft" : "ArrowUp";
      const increase = axis === "x" ? "ArrowRight" : "ArrowDown";
      if (event.key === decrease || event.key === increase) { event.preventDefault(); change(value + (event.key === increase ? 1 : -1) * (event.shiftKey ? 10 : 2)); }
      else if (event.key === "Enter") { event.preventDefault(); onChange(initial); }
      else if (event.key === "Home" || event.key === "End") { event.preventDefault(); change(event.key === "Home" ? 0 : 100); }
    }}><span aria-hidden="true" /></div>;
}
