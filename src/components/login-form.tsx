"use client";

import { apiRequest, jsonRequest } from "@/lib/api-request";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, ArrowRight, LoaderCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { useActivityProgress } from "./activity-progress";

export function LoginForm({ next = "/", initialMessage = "" }: { next?: string; initialMessage?: string }) {
  const [showKeyword, setShowKeyword] = useState(false);
  const composingKeyword = useRef(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();
  useActivityProgress(pending || sent, sent ? "로그인 후 화면 이동 중" : "로그인 중");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (composingKeyword.current || pending) return;
    setMessage("");
    setPending(true);
    try {
      const keyword = ((event.currentTarget as HTMLFormElement).elements.namedItem("member-keyword") as HTMLInputElement).value;
      await apiRequest("/api/access/login", jsonRequest("POST", { email, keyword, next }));
      setSent(true);
      setMessage("로그인되었습니다. 잠시 후 지도로 이동합니다.");
      router.replace(next);
    } catch (error) {
      setMessage((error as Error).message);
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
        <div className="keyword-input">
          {/* Password inputs disable Korean IME in some browsers. Mask only the display. */}
          <Input id="member-keyword" name="member-keyword" type="text" data-masked={!showKeyword} placeholder="등록된 키워드" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="login-message" maxLength={100} disabled={pending} required onCompositionStart={() => { composingKeyword.current = true; }} onCompositionEnd={() => { composingKeyword.current = false; }} />
          <Button variant="ghost" size="icon" aria-label={showKeyword ? "키워드 숨기기" : "키워드 표시"} aria-pressed={showKeyword} disabled={pending} onClick={() => setShowKeyword(value => !value)}>{showKeyword ? <EyeOff /> : <Eye />}</Button>
        </div>
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
