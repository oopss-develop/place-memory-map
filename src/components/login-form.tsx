"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

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
      <FieldGroup>
      <Field data-disabled={pending}>
        <FieldLabel htmlFor="member-email">등록된 이메일</FieldLabel>
        <InputGroup>
        <InputGroupAddon><Mail aria-hidden="true" /></InputGroupAddon>
        <InputGroupInput id="member-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setSent(false); }} placeholder="name@example.com" autoComplete="email" inputMode="email" aria-describedby="login-message" maxLength={254} disabled={pending} required />
        </InputGroup>
      </Field>
      <Field data-disabled={pending}>
        <FieldLabel htmlFor="member-keyword">키워드</FieldLabel>
        <Input id="member-keyword" name="member-keyword" type="text" placeholder="등록된 키워드" autoComplete="off" aria-describedby="login-message" maxLength={100} disabled={pending} required />
      </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending || sent} aria-busy={pending}>
        {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden="true" /> : null}
        {pending ? "로그인 중…" : sent ? "로그인 완료" : "로그인"}<ArrowRight data-icon="inline-end" aria-hidden="true" />
      </Button>
      <p id="login-message" className="form-message" aria-live="polite">{message || "등록된 이메일과 키워드를 입력해 주세요."}</p>
    </form>
  );
}
