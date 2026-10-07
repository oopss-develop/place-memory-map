"use client";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MemoryPicker({ available, busy, onPick }: { available: boolean; busy: boolean; onPick: () => void }) {
  return <div className="memory-picker"><Button variant="outline" disabled={!available || busy} onClick={onPick} aria-describedby={!available ? "memory-picker-hint" : undefined}><Shuffle />추억 한 장</Button>{!available && <small id="memory-picker-hint">방문 기록을 남기면 추억을 꺼낼 수 있어요</small>}</div>;
}
