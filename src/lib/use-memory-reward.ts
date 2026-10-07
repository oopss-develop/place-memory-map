"use client";
import { useRef, useState } from "react";

export interface MemoryReward { requestId: string; visitId: string; groupId: string }
export function useMemoryReward(userId: string) {
  const pending = useRef<MemoryReward | undefined>(undefined);
  const seen = useRef(new Set<string>());
  const [reward, setReward] = useState<MemoryReward>();
  function complete() {
    const ticket = pending.current;
    pending.current = undefined;
    if (!ticket || seen.current.has(ticket.requestId)) return false;
    const key = `place-memory-rewards-v1:${userId}`;
    let saved: string[] = [];
    try { const raw = JSON.parse(sessionStorage.getItem(key) ?? "[]"); if (Array.isArray(raw)) saved = raw.filter(value => typeof value === "string"); } catch { /* Session storage is optional. */ }
    if (saved.includes(ticket.requestId)) return false;
    seen.current.add(ticket.requestId);
    try { sessionStorage.setItem(key, JSON.stringify([...saved, ticket.requestId])); } catch { /* In-memory deduplication remains active. */ }
    setReward(ticket);
    return true;
  }
  return { pending, reward, complete };
}
