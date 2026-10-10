"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { Sticker } from "@/lib/stickers";
export function StickerImage({ sticker, preview = false }: { sticker: Sticker; preview?: boolean }) {
  const [reduced, setReduced] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReduced(media.matches); setPlaying(false); };
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const paused = sticker.animated && (preview || reduced) && !playing;
  const src = paused ? sticker.previewSrc : sticker.src;
  if (failed) return <span className="sticker-unavailable">사용할 수 없는 이모티콘</span>;
  return <span className="sticker-image">
    {src ? <Image unoptimized src={src} alt={sticker.name} width={128} height={128} onError={() => setFailed(true)} /> : <span>{sticker.name}</span>}
    {paused && !preview && <button type="button" onClick={() => setPlaying(true)} aria-label={`${sticker.name} 재생`}>▶ 재생</button>}
    {sticker.animated && playing && <button type="button" onClick={() => setPlaying(false)} aria-label={`${sticker.name} 정지`}>정지</button>}
    {preview && sticker.animated && <small>GIF</small>}
  </span>;
}
