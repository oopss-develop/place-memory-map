"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiRequest, jsonRequest } from "@/lib/api-request";
import type { Sticker, StickerSeries } from "@/lib/stickers";
import { StickerImage } from "./sticker-image";
type Catalog = { series: StickerSeries[]; favorites?: string[]; signedIn?: boolean; favoritesError?: string };
export function StickerPicker({ onSelect }: { onSelect: (sticker: Sticker) => void }) {
  const [series, setSeries] = useState<StickerSeries[]>([]);
  const [active, setActive] = useState("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favoriteError, setFavoriteError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const favoriteLock = useRef(false);
  const drag = useRef<{ x: number; scroll: number; moved: boolean } | null>(null);
  const id = useId();
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<Catalog>("/api/stickers", { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setSeries(result.series); setFavorites(result.favorites ?? []); setSignedIn(result.signedIn ?? false); setFavoriteError(result.favoritesError ?? ""); }
    }).catch(reason => { if (!controller.signal.aborted) setError((reason as Error).message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => { if (expanded) dialog.current?.showModal(); }, [expanded]);
  async function toggleFavorite(sticker: Sticker) {
    if (favoriteLock.current) return;
    favoriteLock.current = true; setSaving(true); setFavoriteError("");
    const favorite = !favorites.includes(sticker.id);
    try {
      await apiRequest("/api/stickers/favorites", jsonRequest("POST", { stickerId: sticker.id, favorite }));
      setFavorites(current => favorite ? [...current, sticker.id] : current.filter(id => id !== sticker.id));
    } catch (reason) { setFavoriteError((reason as Error).message); }
    finally { favoriteLock.current = false; setSaving(false); }
  }
  const all = series.flatMap(s => s.stickers);
  const selected = active === "all" ? all : active === "favorites" ? all.filter(s => favorites.includes(s.id)) : series.find(s => s.id === active)?.stickers ?? [];
  const contents = <>
    <div className="sticker-picker-heading"><strong>이모티콘</strong><button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "닫기" : "크게 보기"}</button></div>
    {loading && <p role="status">이모티콘을 불러오는 중…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => { setError(""); setLoading(true); setAttempt(n => n+1); }}>다시 시도</button></p>}
    {favoriteError && <p role="alert">{favoriteError}</p>}
    {!loading && !error && !series.length && <p>등록된 이모티콘이 없어요.</p>}
    <div className="sticker-series" aria-label="이모티콘 시리즈"
      onPointerDown={event => { if (event.pointerType !== "mouse" || event.button !== 0) return; drag.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft, moved: false }; }}
      onPointerMove={event => { const start = drag.current; if (!start || event.buttons !== 1) return; const offset = event.clientX - start.x; if (Math.abs(offset) > 5) { start.moved = true; event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.scrollLeft = start.scroll - offset; } }}
      onPointerCancel={() => { drag.current = null; }}
      onClickCapture={event => { if (drag.current?.moved) { event.preventDefault(); event.stopPropagation(); } drag.current = null; }}>
      {[{ id: "all", name: "전체" }, { id: "favorites", name: "★ 즐겨찾기" }, ...series].map(s => <button type="button" key={s.id} aria-pressed={active === s.id} aria-controls={id} onClick={() => setActive(s.id)}>{s.name}</button>)}
    </div>
    {active === "favorites" && !loading && !selected.length && <p className="visit-comments-muted">{signedIn ? "별을 눌러 자주 쓰는 이모티콘을 모아 보세요." : "로그인하면 계정별 즐겨찾기를 사용할 수 있어요."}</p>}
    <div id={id} className="sticker-grid" aria-label={active === "all" ? "전체 이모티콘" : active === "favorites" ? "즐겨찾기" : series.find(s => s.id === active)?.name}>{selected.map(s => <div className="sticker-tile" key={s.id}>
      <button type="button" className="sticker-select" title={s.name} onClick={() => { setExpanded(false); onSelect(s); }} aria-label={`${s.name} 선택`}><StickerImage sticker={s} preview /><span className="sticker-name">{s.name.replaceAll("_", " ")}</span></button>
      {signedIn && <button type="button" className="sticker-star" aria-label={`${s.name} 즐겨찾기 ${favorites.includes(s.id) ? "해제" : "추가"}`} aria-pressed={favorites.includes(s.id)} disabled={saving} onClick={() => void toggleFavorite(s)}>{favorites.includes(s.id) ? "★" : "☆"}</button>}
    </div>)}</div>
  </>;
  return expanded ? createPortal(<dialog ref={dialog} className="sticker-dialog" aria-label="이모티콘 전체보기" onClose={() => setExpanded(false)} onCancel={() => setExpanded(false)} onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }}><div className="sticker-picker sticker-picker-expanded">{contents}</div></dialog>, document.body) : <div className="sticker-picker" aria-label="이모티콘 선택창">{contents}</div>;
}
