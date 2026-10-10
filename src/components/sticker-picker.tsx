"use client";
import { useEffect, useId, useState } from "react";
import { apiRequest } from "@/lib/api-request";
import type { Sticker, StickerSeries } from "@/lib/stickers";
import { StickerImage } from "./sticker-image";
export function StickerPicker({ onSelect }: { onSelect: (sticker: Sticker) => void }) {
  const [series, setSeries] = useState<StickerSeries[]>([]);
  const [active, setActive] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const id = useId();
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ series: StickerSeries[] }>("/api/stickers", { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setSeries(result.series); setActive(result.series[0]?.id ?? ""); }
    }).catch(reason => { if (!controller.signal.aborted) setError((reason as Error).message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  const selected = series.find(s => s.id === active);
  return <div className="sticker-picker" aria-label="이모티콘 선택창">
    {loading && <p role="status">이모티콘을 불러오는 중…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => { setError(""); setLoading(true); setAttempt(n => n+1); }}>다시 시도</button></p>}
    {!loading && !error && !series.length && <p>등록된 이모티콘이 없어요.</p>}
    <div className="sticker-series" aria-label="이모티콘 시리즈">{series.map(s => <button type="button" key={s.id} aria-pressed={active === s.id} aria-controls={id} onClick={() => setActive(s.id)}>{s.name}</button>)}</div>
    <div id={id} className="sticker-grid" aria-label={selected?.name}>{selected?.stickers.map(s => <button type="button" key={s.id} onClick={() => onSelect(s)} aria-label={`${s.name} 선택`}><StickerImage sticker={s} preview /><span>{s.name}</span></button>)}</div>
  </div>;
}
