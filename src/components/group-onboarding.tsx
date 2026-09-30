"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GroupOnboarding() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "그룹을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }
  return <main className="onboarding-page"><section><div className="brand-mark"><img src="/map-pins/sparkle-yellow-round.png" alt="" /><span>PLACE MEMORY MAP</span></div><Users size={34} className="onboarding-icon" /><h1>누구와 지도를<br />채워볼까요?</h1><p>첫 지도를 만들면 등록된 네 명에게 자동 공유됩니다. 장소 기록과 여행 계획을 함께 보고 수정할 수 있어요.</p><form onSubmit={create}><Label htmlFor="group-name">그룹 이름</Label><Input id="group-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 우리 둘의 지도" maxLength={60} required /><Button className="primary-button" type="submit" disabled={pending}>{pending ? "만드는 중…" : "첫 지도 만들기"}</Button><span aria-live="polite">{message}</span></form></section></main>;
}
