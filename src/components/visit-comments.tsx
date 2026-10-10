"use client";

import { useEffect, useId, useRef, useState } from "react";
import { apiRequest, jsonRequest } from "@/lib/api-request";
import { Button } from "./ui/button";
import { useConfirmation } from "./confirmation";

import type { Sticker } from "@/lib/stickers";
import { StickerPicker } from "./sticker-picker";
import { StickerImage } from "./sticker-image";

interface CommentsResult { comments: Comment[]; warning?: string; stickersAvailable?: boolean }
interface Comment { stickerId?: string | null; sticker?: Sticker | null; id: string; body: string; authorName: string; createdAt: string; own: boolean }
export function VisitComments({ visitId, demo = false }: { visitId: string; demo?: boolean }) {
  const inputId = useId();
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [sticker, setSticker] = useState<Sticker | null>(null);
  const [picker, setPicker] = useState(false);
  const [loading, setLoading] = useState(!demo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState("");
  const [stickersAvailable, setStickersAvailable] = useState(true);
  const pending = useRef<{ id: string; body: string; stickerId: string | null } | null>(null);
  const mounted = useRef(true);
  const lock = useRef(false);
  const confirmation = useConfirmation();
  const url = `/api/visits/${visitId}/comments`;
  async function refresh(signal?: AbortSignal) {
    const result = await apiRequest<CommentsResult>(url, { signal });
    if (mounted.current && !signal?.aborted) { setComments(result.comments); setWarning(result.warning ?? ""); setStickersAvailable(result.stickersAvailable !== false); }
  }
  useEffect(() => {
    mounted.current = true;
    if (demo) return () => { mounted.current = false; };
    const controller = new AbortController();
    apiRequest<CommentsResult>(url, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) { setComments(result.comments); setWarning(result.warning ?? ""); setStickersAvailable(result.stickersAvailable !== false); } }).catch(reason => {
      if (!controller.signal.aborted) setError((reason as Error).message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { mounted.current = false; controller.abort(); };
  }, [url, demo]);
  useEffect(() => {
    if (demo || loading) return;
    const targetId = new URLSearchParams(window.location.search).get("commentId");
    if (!targetId || !comments.some(comment => comment.id === targetId)) return;
    const target = document.getElementById("comment-" + targetId);
    if (!target) return;
    let cancelled = false;
    let marking = false;
    const mark = async () => {
      if (marking || cancelled) return;
      marking = true;
      try {
        await apiRequest("/api/comment-notifications", jsonRequest("POST", { commentId: targetId }));
        if (!cancelled) { window.dispatchEvent(new CustomEvent("comment-notification-read", { detail: targetId })); setNotice("댓글 알림을 확인했어요."); }
      } catch (reason) { if (!cancelled) setError((reason as Error).message); marking = false; }
    };
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void mark(); }, { threshold: 0.1 });
    const frame = requestAnimationFrame(() => { target.scrollIntoView({ block: "center", behavior: "instant" }); target.focus({ preventScroll: true }); observer.observe(target); });
    return () => { cancelled = true; cancelAnimationFrame(frame); observer.disconnect(); };
  }, [comments, loading, demo]);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || (!draft.trim() && !sticker)) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    const body = draft.trim();
    if (!pending.current || pending.current.body !== body || pending.current.stickerId !== (sticker?.id ?? null)) pending.current = { id: crypto.randomUUID(), body, stickerId: sticker?.id ?? null };
    try {
      await apiRequest(url, jsonRequest("POST", pending.current));
      if (!mounted.current) return;
      pending.current = null; setDraft(""); setSticker(null); setPicker(false); setNotice("댓글을 남겼어요.");
      await refresh();
    } catch (reason) { if (mounted.current) setError((reason as Error).message); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function remove(id: string) {
    if (lock.current || !await confirmation.confirm("이 댓글을 삭제할까요?")) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await apiRequest(url, jsonRequest("DELETE", { id }));
      if (mounted.current) { setComments(current => current.filter(comment => comment.id !== id)); setNotice("댓글을 삭제했어요."); }
    } catch (reason) { if (mounted.current) setError((reason as Error).message); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="visit-comments" aria-label="기록 댓글" onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }}>
    <div className="visit-comments-heading"><h4>댓글 {comments.length > 0 ? comments.length : ""}</h4>{!demo && <Button variant="ghost" size="sm" disabled={busy || loading} onClick={async () => { setLoading(true); setError(""); try { await refresh(); } catch (reason) { if (mounted.current) setError((reason as Error).message); } finally { if (mounted.current) setLoading(false); } }}>새로고침</Button>}</div>
    {demo ? <><p className="visit-comments-muted">로그인하고 저장소를 연결하면 댓글을 남길 수 있어요.</p><Button type="button" variant="ghost" aria-expanded={picker} onClick={() => setPicker(!picker)}>이모티콘 둘러보기</Button>{picker && <StickerPicker onSelect={selected => { setSticker(selected); setPicker(false); }} />}{sticker && <StickerImage key={sticker.src} sticker={sticker} />}</> : <>
      {loading && <p role="status">댓글을 불러오는 중…</p>}
      {!loading && !error && !comments.length && <p className="visit-comments-muted">이 기록에 첫 댓글을 남겨 보세요.</p>}
      <ul className="visit-comments-list">{comments.map(comment => <li key={comment.id} id={`comment-${comment.id}`} tabIndex={-1}><div className="visit-comment-meta"><strong>{comment.authorName}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>{comment.own && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove(comment.id)} aria-label={`${comment.authorName}님의 댓글 삭제`}>삭제</Button>}</div>{comment.body && <p>{comment.body}</p>}{comment.stickerId && (comment.sticker ? <StickerImage key={comment.sticker.src} sticker={comment.sticker} /> : <p className="sticker-unavailable">사용할 수 없는 이모티콘</p>)}</li>)}</ul>
      <form onSubmit={send}><label htmlFor={inputId}>댓글 남기기</label><textarea id={inputId} value={draft} onChange={event => setDraft(event.target.value)} maxLength={1000} rows={3} disabled={busy} placeholder="함께한 순간에 대한 이야기를 남겨 주세요." /><div className="sticker-controls"><Button type="button" variant="ghost" disabled={busy || !stickersAvailable} aria-expanded={picker} onClick={() => setPicker(!picker)}>{sticker ? "이모티콘 교체" : "이모티콘 선택"}</Button>{sticker && <><StickerImage key={sticker.src} sticker={sticker} /><Button type="button" variant="ghost" disabled={busy} onClick={() => { setSticker(null); setPicker(false); }}>선택 취소</Button></>}</div>{picker && !busy && <StickerPicker onSelect={selected => { setSticker(selected); setPicker(false); }} />}<div className="visit-comment-actions"><small>{draft.length}/1000</small><Button type="submit" disabled={busy || loading || (!draft.trim() && !sticker)}>{busy ? "처리 중…" : "댓글 등록"}</Button></div></form>
      {warning && <p role="status" className="visit-comments-muted">{warning}</p>}{error && <p role="alert" className="visit-comments-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    </>}{confirmation.dialog}
  </section>;
}
