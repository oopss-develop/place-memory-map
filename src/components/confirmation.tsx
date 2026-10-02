"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
export function useConfirmation() {
  const [message, setMessage] = useState<string>();
  const pending = useRef<((value: boolean) => void) | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (message && !ref.current?.open) ref.current?.showModal(); }, [message]);
  useEffect(() => () => pending.current?.(false), []);
  function finish(value: boolean) { pending.current?.(value); pending.current = null; ref.current?.close(); setMessage(undefined); }
  const confirm = (text: string) => new Promise<boolean>(resolve => { pending.current?.(false); pending.current = resolve; setMessage(text); });
  const dialog = <dialog ref={ref} className="confirmation-dialog" aria-label="삭제 확인" onCancel={(event) => { event.preventDefault(); finish(false); }} onClose={() => { if (pending.current) finish(false); }}><h2>삭제할까요?</h2><p>{message}</p><div><Button variant="outline" onClick={() => finish(false)} autoFocus>취소</Button><Button variant="destructive" onClick={() => finish(true)}>삭제</Button></div></dialog>;
  return { confirm, dialog };
}
