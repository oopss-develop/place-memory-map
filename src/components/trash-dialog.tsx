"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
export function TrashDialog({ visits, loading, error, onRestore, onClose }: { loading?: boolean; error?: string; visits: Array<{ id: string; title: string; version: number; deleted_at: string; places?: { name: string } }>; onRestore: (id: string, version: number) => Promise<void>; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null); const [busy, setBusy] = useState<string>();
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="trash-dialog" aria-label="휴지통" onClose={onClose}><header><h2>휴지통</h2><Button variant="ghost" onClick={() => ref.current?.close()}>닫기</Button></header><p>삭제한 기록과 사진은 30일 안에 복원할 수 있어요.</p>{loading && <p role="status">휴지통을 불러오는 중…</p>}{error && <p role="alert">{error}</p>}{!loading && !error && !visits.length && <p>복원할 기록이 없습니다.</p>}{visits.map(visit => <article key={visit.id}><div><strong>{visit.places?.name ?? visit.title}</strong><p>{visit.title}</p><small>{new Date(visit.deleted_at).toLocaleDateString("ko-KR")} 삭제</small></div><Button variant="outline" disabled={Boolean(busy)} onClick={async () => { setBusy(visit.id); try { await onRestore(visit.id,visit.version); } finally { setBusy(undefined); } }}>{busy===visit.id ? "복원 중…" : "복원"}</Button></article>)}</dialog>;
}
