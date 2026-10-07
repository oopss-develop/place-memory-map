"use client";
import { useEffect, useRef, useState } from "react";
import type { Visit } from "@/types/domain";
export function usePhotoViewer(visits: Visit[], selectedId?: string) {
  const [lightbox, setLightbox] = useState(false);
  const lightboxRef = useRef<HTMLDialogElement>(null);
  const [lightboxOffset, setLightboxOffset] = useState({ x: 0, y: 0 });
  const [lightboxAspect, setLightboxAspect] = useState(1.6);
  const lightboxDrag = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number; rect: DOMRect } | null>(null);

  const [photoView, setPhotoView] = useState<{ visitId: string; index: number }>({ visitId: "", index: 0 });
const selected = visits.find(visit => visit.id === selectedId);
  useEffect(() => { if (lightbox && !lightboxRef.current?.open) lightboxRef.current?.showModal(); }, [lightbox]);
  useEffect(() => {
    if (!lightbox) return;
    const recenter = () => { lightboxDrag.current = null; setLightboxOffset({ x: 0, y: 0 }); };
    window.addEventListener("resize", recenter);
    return () => window.removeEventListener("resize", recenter);
  }, [lightbox]);
  function moveLightbox(x: number, y: number, rect: DOMRect, offsetX: number, offsetY: number) {
    const margin = 16;
    setLightboxOffset({
      x: offsetX + Math.max(margin - rect.left, Math.min(x, window.innerWidth - margin - rect.right)),
      y: offsetY + Math.max(margin - rect.top, Math.min(y, window.innerHeight - margin - rect.bottom)),
    });
  }

  function showPhoto(offset: number) {
    if (!selected || selected.photoUrls.length < 2) return;
    setPhotoView((current) => {
      const index = current.visitId === selected.id ? current.index : 0;
      return { visitId: selected.id, index: (index + offset + selected.photoUrls.length) % selected.photoUrls.length };
    });
  }


return { lightbox, setLightbox, lightboxRef, lightboxOffset, setLightboxOffset, lightboxAspect, setLightboxAspect, lightboxDrag, photoView, setPhotoView, moveLightbox, showPhoto };
}
