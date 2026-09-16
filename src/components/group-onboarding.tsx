"use client";

import { useState } from "react";
import { Users } from "lucide-react";

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
  return <main className="onboarding-page"><section><div className="brand-mark"><img src="/map-pins/color-16.png" alt="" /><span>PLACE MEMORY MAP</span></div><Users size={34} className="onboarding-icon" /><h1>누구와 지도를<br />채워볼까요?</h1><p>첫 그룹을 만들면 바로 장소와 기억을 남길 수 있어요. 초대 링크로 함께할 사람을 부를 수 있습니다.</p><form onSubmit={create}><label htmlFor="group-name">그룹 이름</label><input id="group-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 우리 둘의 지도" maxLength={60} required /><button className="primary-button" disabled={pending}>{pending ? "만드는 중…" : "첫 지도 만들기"}</button><span aria-live="polite">{message}</span></form></section></main>;
}
