"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function QuickFilters({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; scroll: number; moved: boolean } | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  function updateEdges() {
    const element = viewport.current;
    if (element) setEdges({ left: element.scrollLeft > 1, right: element.scrollLeft + element.clientWidth < element.scrollWidth - 1 });
  }
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const frame = requestAnimationFrame(updateEdges);
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [options]);
  function move(direction: number) {
    const element = viewport.current;
    element?.scrollBy({ left: direction * element.clientWidth * .8, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <div className="quick-filter-rail">
    <Button variant="ghost" size="icon" aria-label="이전 빠른 필터 보기" disabled={!edges.left} onClick={() => move(-1)}><ChevronLeft /></Button>
    <div ref={viewport} className="quick-filter-viewport" onScroll={updateEdges}
      onPointerDown={event => { if (event.button === 0) drag.current = { x: event.clientX, y: event.clientY, scroll: event.currentTarget.scrollLeft, moved: false }; }}
      onPointerMove={event => {
        const start = drag.current;
        if (!start || event.buttons === 0) return;
        const dx = event.clientX - start.x;
        if (!start.moved && (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(event.clientY - start.y))) return;
        start.moved = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.scrollLeft = start.scroll - dx;
      }}
      onPointerCancel={() => { drag.current = null; }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onClickCapture={event => { if (drag.current?.moved) { event.preventDefault(); event.stopPropagation(); } drag.current = null; }}>
      <ToggleGroup className="filter-row" type="single" value={value} onValueChange={selected => { if (selected) onChange(selected); }} spacing={1} aria-label="기록 필터">
        {options.map(option => <ToggleGroupItem key={option} value={option}>{option}</ToggleGroupItem>)}
      </ToggleGroup>
    </div>
    <Button variant="ghost" size="icon" aria-label="다음 빠른 필터 보기" disabled={!edges.right} onClick={() => move(1)}><ChevronRight /></Button>
  </div>;
}
