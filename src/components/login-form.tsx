"use client";

import { useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";

export function LoginForm({ next = "/" }: { next?: string }) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const response = await fetch("/api/access/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = await response.json().catch(() => null) as { error?: string } | null;
    setPending(false);
    if (!response.ok) return setMessage(data?.error ?? "입장 코드를 확인해 주세요.");
    window.location.assign(next);
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="access-code">우리만의 입장 코드</label>
      <div className="input-with-icon">
        <KeyRound aria-hidden="true" size={18} />
        <input id="access-code" type="text" value={code} onChange={(event) => setCode(event.target.value)} placeholder="네 글자 중 하나를 입력하세요" autoComplete="off" maxLength={1} required />
      </div>
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "확인하는 중…" : "지도 들어가기"}<ArrowRight size={18} aria-hidden="true" />
      </button>
      <p className="form-message" aria-live="polite">{message || "또 · 나 · 우 · 쥐 중 하나를 입력해 주세요."}</p>
    </form>
  );
}
