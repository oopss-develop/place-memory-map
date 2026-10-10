"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, MessageCircle } from "lucide-react";
import { apiRequest } from "@/lib/api-request";
import type { CommentNotification } from "@/lib/comment-notifications";
import { Button } from "./ui/button";
export function CommentNotifications({ demo = false }: { demo?: boolean }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"unread" | "recent">("unread");
  const [items, setItems] = useState<CommentNotification[]>([]);
  const [count, setCount] = useState<number>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    ref.current?.showModal();
    if (demo) return;
    const controller = new AbortController();
    apiRequest<{ notifications: CommentNotification[]; unreadCount: number }>("/api/comment-notifications", { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setItems(result.notifications); setCount(result.unreadCount); }
    }).catch(reason => { if (!controller.signal.aborted) setError((reason as Error).message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, attempt, demo]);
  useEffect(() => {
    const read = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      setItems(current => current.map(item => item.commentId === id ? { ...item, readAt: new Date().toISOString() } : item));
      setCount(undefined);
    };
    window.addEventListener("comment-notification-read", read);
    return () => window.removeEventListener("comment-notification-read", read);
  }, []);
  const listed = (tab === "unread" ? items.filter(item => !item.readAt) : items).toSorted((a,b) => b.createdAt.localeCompare(a.createdAt));
  return <>
    <Button type="button" variant="outline" className="comment-notification-button" onClick={() => { setError(""); setLoading(!demo); setOpen(true); }}><Bell size={17} aria-hidden="true" />댓글 알림{count !== undefined && count > 0 && <span className="notification-count">{count > 99 ? "99+" : count}</span>}</Button>
    {open && createPortal(<dialog ref={ref} className="comment-notification-dialog" aria-label="댓글 알림과 최근 댓글" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }}>
      <header><div><h2>댓글 소식</h2><p>함께 남긴 이야기를 모아 보세요.</p></div><Button type="button" variant="ghost" onClick={() => setOpen(false)}>닫기</Button></header>
      <div className="notification-tabs"><Button type="button" variant={tab === "unread" ? "secondary" : "ghost"} aria-pressed={tab === "unread"} onClick={() => setTab("unread")}>미확인 알림{count ? ` ${count}` : ""}</Button><Button type="button" variant={tab === "recent" ? "secondary" : "ghost"} aria-pressed={tab === "recent"} onClick={() => setTab("recent")}>최근 댓글</Button>{!demo && <Button type="button" variant="ghost" disabled={loading} onClick={() => { setLoading(true); setError(""); setAttempt(n => n+1); }}>새로고침</Button>}</div>
      {demo ? <p className="notification-empty">로그인하면 댓글 소식과 계정별 알림을 볼 수 있어요.</p> : <>
        {loading && <p role="status">댓글 소식을 불러오는 중…</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && !error && !listed.length && <p className="notification-empty">{tab === "unread" ? "모든 댓글 소식을 확인했어요." : "아직 남긴 댓글이 없어요."}</p>}
        <ul className="notification-list">{listed.map(item => <li key={item.commentId}><a href={`/?groupId=${encodeURIComponent(item.groupId)}&visitId=${encodeURIComponent(item.visitId)}&commentId=${encodeURIComponent(item.commentId)}#comment-${item.commentId}`}>
          <span className="notification-icon"><MessageCircle size={20} aria-hidden="true" /></span><div><div className="notification-meta"><strong>{item.authorName}{item.own ? " · 나" : ""}</strong>{!item.readAt && <span className="notification-new">새 댓글</span>}<time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div><strong className="notification-place">{item.placeName}</strong><p>{item.body || "이모티콘을 남겼어요."}{item.stickerName && item.body ? ` · ${item.stickerName}` : ""}</p><small>댓글 보러 가기 →</small></div>
        </a></li>)}</ul>
        <p className="notification-hint">댓글을 확인하면 미확인 알림에서 사라져요. 최근 댓글에는 기록이 남아요. 최대 100개를 표시합니다.</p>
      </>}
    </dialog>, document.body)}
  </>;
}
