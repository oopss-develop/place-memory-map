"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import { MapPin, Star, X } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import type { Visit } from "@/types/domain";
import { VisitComments } from "./visit-comments";

interface Detail { visit: Visit; groupName: string; photoWarning?: string }
export function VisitDetailCard({ detail, onClose, onRetry, demo = false }: { detail: Detail; onClose: () => void; onRetry: () => void; demo?: boolean }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, []);
  const visit = detail.visit;
  return <section ref={panel} id="overview-visit-detail" className="visit-detail-card" aria-labelledby="visit-detail-title" tabIndex={-1} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    <header className="visit-detail-header"><h2 id="visit-detail-title">방문 기록</h2><Button variant="ghost" size="icon" aria-label="방문 기록 닫기" onClick={onClose}><X /></Button></header>
    <div className="visit-detail-body">
      {visit && <><div className="visit-detail-meta"><time>{visit.visitedOn}</time><span>{detail.groupName}</span>{visit.isPlanned && <Badge variant="outline">방문 예정</Badge>}</div><h3 className="visit-detail-place">{visit.place.name}</h3><p className="visit-detail-address"><MapPin size={16} aria-hidden="true" />{visit.place.address || "직접 지정한 위치"}</p>{visit.place.category && <p className="visit-detail-category">{visit.place.category}</p>}
        <div className="visit-detail-rating" aria-label={`별점 ${Number(visit.rating).toFixed(1)}점, 5점 만점`}><Star size={20} fill="currentColor" aria-hidden="true" /><strong>{Number(visit.rating).toFixed(1)}</strong><span>/ 5.0</span></div>
        <section className="visit-detail-memory" aria-label="기록 내용">{visit.title && <h4>{visit.title}</h4>}<p>{visit.note || "남긴 메모가 없어요."}</p></section>
        <dl className="visit-detail-facts"><div><dt>함께한 사람</dt><dd>{visit.participants.length ? visit.participants.map(person => <Badge variant="secondary" key={person.id}>{person.displayName}</Badge>) : "선택한 사람이 없어요."}</dd></div><div><dt>태그</dt><dd>{visit.tags.length ? visit.tags.map(tag => <Badge variant="outline" key={tag}>#{tag}</Badge>) : "남긴 태그가 없어요."}</dd></div></dl>
        {detail.photoWarning && <div className="visit-detail-warning" role="status"><p>{detail.photoWarning}</p><Button variant="outline" onClick={onRetry}>사진 다시 불러오기</Button></div>}
        {visit.photoUrls.length > 0 && <section className="visit-detail-photos" aria-label="기록 사진"><h4>사진 {visit.photoUrls.length}장</h4>{visit.photoUrls.map((url, index) => <Image unoptimized key={visit.photoIds?.[index] ?? index} src={url} width={640} height={480} alt={`${visit.place.name} 방문 사진 ${index + 1}`} />)}</section>}
        <VisitComments key={visit.id} visitId={visit.id} demo={demo} />
      </>}
    </div>
  </section>;
}
