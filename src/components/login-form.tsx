"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Send } from "lucide-react";

export function LoginForm({ next = "/", initialMessage = "" }: { next?: string; initialMessage?: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setPending(true);
    try {
      const keyword = ((event.currentTarget as HTMLFormElement).elements.namedItem("member-keyword") as HTMLInputElement).value;
      const response = await fetch("/api/access/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, keyword, next }) });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) return setMessage(data?.error ?? "로그인하지 못했습니다.");
      setSent(true);
      setMessage("로그인되었습니다. 잠시 후 지도로 이동합니다.");
      router.replace(next);
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
      <label htmlFor="member-keyword">키워드</label>
      <div className="input-with-icon">
        <input id="member-keyword" name="member-keyword" type="text" placeholder="등록된 키워드" autoComplete="off" aria-describedby="login-message" maxLength={100} disabled={pending} required />
      </div>
      <button className="primary-button" type="submit" disabled={pending || sent}>
        {pending ? "로그인 중…" : sent ? "로그인 완료" : "로그인"}<Send size={18} aria-hidden="true" />
      </button>
      <p id="login-message" className="form-message" aria-live="polite">{message || "등록된 이메일과 키워드를 입력해 주세요."}</p>
    </form>
  );
}
