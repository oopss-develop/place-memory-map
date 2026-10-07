"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Star, X } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import type { Group, Visit } from "@/types/domain";

interface Detail { visit: Visit; groupName: string; photoWarning?: string }
export function VisitDetailCard({ visitId, groupId, groups, demo, onClose }: { visitId: string; groupId: string; groups: Group[]; demo: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const element = dialog.current; element?.showModal();
  }, []);
  useEffect(() => {
    let alive = true, revision = 0, etag = "", issuedAt = 0;
    let controller: AbortController | undefined;
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      controller?.abort(); controller = new AbortController();
      const signal = controller.signal, current = ++revision;
      if (!navigator.onLine && !demo) { setLoading(false); setError("오프라인입니다. 연결이 돌아오면 다시 불러옵니다."); return; }
      try {
        let next: Detail;
        if (demo) {
          const records = JSON.parse(localStorage.getItem("place-memory-visits-v2") ?? "[]") as Visit[];
          const group = groups.find(value => value.id === groupId);
          const visit = records.find(value => value.id === visitId && value.groupId === groupId && !value.deletedAt);
          if (!group || !visit) throw Object.assign(new Error("이 기록은 삭제되었거나 접근 권한이 없습니다."), { status: 404 });
          next = { visit, groupName: group.name };
        } else {
          const renew = Date.now() - issuedAt >= 3540000;
          const response = await fetch(`/api/visits/${encodeURIComponent(visitId)}${renew ? "?renewPhotos=true" : ""}`, { cache: "no-store", signal, headers: etag ? { "If-None-Match": etag } : {} });
          if (!alive || signal.aborted || current !== revision) return;
          if (response.status === 304) { setError(""); return; }
          const body = await response.json();
          if (!response.ok) throw Object.assign(new Error(response.status === 401 ? "로그인이 만료되었습니다. 다시 로그인해 주세요." : body.error ?? "기록을 불러오지 못했습니다."), { status: response.status });
          next = body as Detail;
          if (!next.visit || next.visit.id !== visitId || next.visit.groupId !== groupId) throw new Error("기록 응답을 확인할 수 없습니다.");
          etag = next.photoWarning ? "" : response.headers.get("ETag") ?? ""; issuedAt = Date.now();
        }
        if (!alive || signal.aborted || current !== revision) return;
        setDetail(next); setError("");
      } catch (issue) {
        if (!alive || signal.aborted || current !== revision) return;
        if ([401, 403, 404].includes((issue as { status?: number }).status ?? 0)) { setDetail(undefined); etag = ""; }
        setError(issue instanceof TypeError ? "연결을 확인하고 다시 시도해 주세요." : (issue as Error).message);
      } finally { if (alive && current === revision) setLoading(false); }
    };
    void refresh();
    const sync = () => { if (document.visibilityState === "hidden" || !navigator.onLine) { revision++; controller?.abort(); } if (document.visibilityState !== "hidden") void refresh(); };
    const interval = setInterval(sync, 30000);
    window.addEventListener("focus", sync); window.addEventListener("online", sync); window.addEventListener("offline", sync); document.addEventListener("visibilitychange", sync);
    return () => { alive = false; revision++; controller?.abort(); clearInterval(interval); window.removeEventListener("focus", sync); window.removeEventListener("online", sync); window.removeEventListener("offline", sync); document.removeEventListener("visibilitychange", sync); };
  }, [demo, groupId, groups, retry, visitId]);
  const visit = detail?.visit;
  return <dialog ref={dialog} className="visit-detail-card" aria-labelledby="visit-detail-title" onClose={onClose} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close(); } }}>
    <header className="visit-detail-header"><h2 id="visit-detail-title">방문 기록</h2><Button variant="ghost" size="icon" aria-label="방문 기록 닫기" autoFocus onClick={() => dialog.current?.close()}><X /></Button></header>
    <div className="visit-detail-body">
      {loading && !visit && <p role="status">기록을 불러오는 중…</p>}
      {error && <div className="visit-detail-warning" role="alert"><p>{error}</p><Button variant="outline" onClick={() => setRetry(value => value + 1)}>다시 시도</Button>{error.includes("로그인") && <Link href="/login?next=%2Foverview">로그인</Link>}</div>}
      {visit && <><div className="visit-detail-meta"><time>{visit.visitedOn}</time><span>{detail.groupName}</span>{visit.isPlanned && <Badge variant="outline">방문 예정</Badge>}</div><h3 className="visit-detail-place">{visit.place.name}</h3><p className="visit-detail-address"><MapPin size={16} aria-hidden="true" />{visit.place.address || "직접 지정한 위치"}</p>{visit.place.category && <p className="visit-detail-category">{visit.place.category}</p>}
        <div className="visit-detail-rating" aria-label={`별점 ${Number(visit.rating).toFixed(1)}점, 5점 만점`}><Star size={20} fill="currentColor" aria-hidden="true" /><strong>{Number(visit.rating).toFixed(1)}</strong><span>/ 5.0</span></div>
        <section className="visit-detail-memory" aria-label="기록 내용">{visit.title && <h4>{visit.title}</h4>}<p>{visit.note || "남긴 메모가 없어요."}</p></section>
        <dl className="visit-detail-facts"><div><dt>함께한 사람</dt><dd>{visit.participants.length ? visit.participants.map(person => <Badge variant="secondary" key={person.id}>{person.displayName}</Badge>) : "선택한 사람이 없어요."}</dd></div><div><dt>태그</dt><dd>{visit.tags.length ? visit.tags.map(tag => <Badge variant="outline" key={tag}>#{tag}</Badge>) : "남긴 태그가 없어요."}</dd></div></dl>
        {detail.photoWarning && <div className="visit-detail-warning" role="status"><p>{detail.photoWarning}</p><Button variant="outline" onClick={() => setRetry(value => value + 1)}>사진 다시 불러오기</Button></div>}
        {visit.photoUrls.length > 0 && <section className="visit-detail-photos" aria-label="기록 사진"><h4>사진 {visit.photoUrls.length}장</h4>{visit.photoUrls.map((url, index) => <Image unoptimized key={visit.photoIds?.[index] ?? index} src={url} width={640} height={480} alt={`${visit.place.name} 방문 사진 ${index + 1}`} />)}</section>}
      </>}
    </div>
  </dialog>;
}
