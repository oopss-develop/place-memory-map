"use client";

import { useState } from "react";
import { Mail, Send } from "lucide-react";

export function LoginForm({ next = "/", initialMessage = "" }: { next?: string; initialMessage?: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setPending(true);
    try {
      const response = await fetch("/api/access/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, next }) });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) return setMessage(data?.error ?? "로그인 메일을 보내지 못했습니다.");
      setSent(true);
      setMessage(`${email}로 로그인 링크를 보냈어요. 메일에서 링크를 눌러 주세요.`);
    } catch {
      setMessage("네트워크에 연결하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="member-email">등록된 이메일</label>
      <div className="input-with-icon">
        <Mail aria-hidden="true" size={18} />
        <input id="member-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setSent(false); }} placeholder="name@example.com" autoComplete="email" inputMode="email" aria-describedby="login-message" maxLength={254} disabled={pending} required />
      </div>
      <button className="primary-button" type="submit" disabled={pending || sent}>
        {pending ? "메일 보내는 중…" : sent ? "메일을 확인해 주세요" : "로그인 링크 받기"}<Send size={18} aria-hidden="true" />
      </button>
      <p id="login-message" className="form-message" aria-live="polite">{message || "처음 쓰는 기기에서만 메일 인증이 필요해요. 이후에는 로그인 상태가 유지됩니다."}</p>
    </form>
  );
}
