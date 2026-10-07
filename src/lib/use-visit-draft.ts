"use client";
import { useEffect, useRef, useState } from "react";
import { listDrafts, type SavedDraft } from "./drafts";
import type { Place, Visit } from "@/types/domain";
import type { MarkerStyle } from "./marker-styles";
export type VisitDraftData = { place: Place; editing: Visit | null; fields: Record<string,string[]>; markerStyle: MarkerStyle; requestId: string; hadPhotos: boolean; photoRequests?: Array<{ id: string; name: string; size: number; modified: number }> };
export function useVisitDraft(userKey: string, activeGroupId: string, draftPlace: Place | null) {
  const [visitDrafts, setVisitDrafts] = useState<SavedDraft<VisitDraftData>[]>([]);
  const [restoredFields, setRestoredFields] = useState<Record<string,string[]> | null>(null);
  const [draftKey, setDraftKey] = useState("");
  const [photoRetry, setPhotoRetry] = useState<{ visit: Visit; files: Array<{ id: string; file: File }> }>();
  const requestIdRef = useRef("");
  const photoRequestsRef = useRef<NonNullable<VisitDraftData["photoRequests"]>>([]);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeDraftNow = useRef<(() => void) | null>(null);

  useEffect(() => { const timer=setTimeout(() => setVisitDrafts(listDrafts<VisitDraftData>(userKey + ":visit:" + activeGroupId + ":")),0); return () => clearTimeout(timer); }, [activeGroupId, userKey, draftPlace]);
  useEffect(() => { const cancelTimer = () => { if (draftTimer.current) clearTimeout(draftTimer.current); }; const flush = () => writeDraftNow.current?.(); window.addEventListener("pagehide", flush); return () => { flush(); window.removeEventListener("pagehide", flush); cancelTimer(); }; }, []);
return {visitDrafts,setVisitDrafts,restoredFields,setRestoredFields,draftKey,setDraftKey,photoRetry,setPhotoRetry,requestIdRef,photoRequestsRef,draftTimer,writeDraftNow};
}
