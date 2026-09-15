"use client";

import { useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { magicLinkSchema } from "@/lib/schemas";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm({ configured, next = "/" }: { configured: boolean; next?: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = magicLinkSchema.safeParse({ email });
    if (!parsed.success) return setMessage(parsed.error.issues[0]?.message ?? "이메일을 확인해 주세요.");
    if (!configured) return setMessage("Supabase 키를 연결하면 실제 로그인 메일이 발송됩니다.");
    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setPending(false);
    setMessage(error ? "메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." : "메일함에서 로그인 링크를 확인해 주세요.");
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="email">이메일</label>
      <div className="input-with-icon">
        <Mail aria-hidden="true" size={18} />
        <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required />
      </div>
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "보내는 중…" : "로그인 링크 받기"}<ArrowRight size={18} aria-hidden="true" />
      </button>
      <p className="form-message" aria-live="polite">{message || "비밀번호 없이 이메일 링크로 안전하게 들어갑니다."}</p>
    </form>
  );
}
