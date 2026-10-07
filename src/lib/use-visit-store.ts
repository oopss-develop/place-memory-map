"use client";
import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import type { DashboardData } from "./data";
import type { Visit } from "@/types/domain";
import { clearUserDrafts, clearDraft, listDrafts } from "./drafts";
import { preservePhotoUrls } from "./photo-sync";

export function useVisitStore(initialData: DashboardData, groupId: string, paused: boolean, viewerId = "demo") {
  const [visits, updateVisits] = useState(initialData.visits);
  const [groups, setGroups] = useState(initialData.groups);
  const [members, setMembers] = useState(initialData.members);
  const [error, setError] = useState("");
  const [photoWarning, setPhotoWarning] = useState(initialData.photoWarning ?? "");
  const [loading, setLoading] = useState(false);
  const revision = useRef(0);
  const etag = useRef("");
  const photosIssuedAt = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const current = useRef({ groupId, paused });
  useEffect(() => { current.current = { groupId, paused }; }, [groupId, paused]);
  const setVisits = useCallback((value: SetStateAction<Visit[]>) => { revision.current++; etag.current = ""; updateVisits(value); }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      updateVisits(previous => preservePhotoUrls(previous, initialData.visits));
      setGroups(initialData.groups); setMembers(initialData.members); photosIssuedAt.current = Date.now();
    }, 0);
    return () => clearTimeout(timer);
  }, [initialData]);
  const refresh = useCallback(async (renewPhotos = false, force = false) => {
    if (initialData.demoMode || !groupId || (current.current.paused && !force) || !navigator.onLine || document.visibilityState === "hidden") return;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const requestRevision = ++revision.current;
    try {
      const renew = renewPhotos || Date.now() - photosIssuedAt.current >= 3540000;
      const response = await fetch(`/api/dashboard?groupId=${encodeURIComponent(groupId)}${renew ? "&renewPhotos=true" : ""}`, { cache: "no-store", signal: abort.signal, headers: etag.current ? { "If-None-Match": etag.current } : {} });
      if (requestRevision !== revision.current || current.current.groupId !== groupId) return;
      if (response.status === 304) { setError(""); return; }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          if (response.status === 401) clearUserDrafts(viewerId);
          else for (const draft of listDrafts(viewerId + ":visit:" + groupId + ":")) clearDraft(draft.key);
          updateVisits([]); setMembers([]); etag.current = "";
          setGroups(previous => response.status === 401 ? [] : previous.filter(group => group.id !== groupId));
        }
        throw new Error(response.status === 401 ? "로그인이 만료되었습니다. 다시 로그인해 주세요." : "기록을 불러오지 못했습니다. 다시 시도해 주세요.");
      }
      const data = await response.json() as DashboardData;
      if (requestRevision !== revision.current || current.current.groupId !== groupId || (current.current.paused && !force)) return;
      updateVisits(previous => preservePhotoUrls(previous, data.visits));
      setGroups(data.groups); setMembers(data.members); setPhotoWarning(data.photoWarning ?? ""); setError("");
      etag.current = data.photoWarning ? "" : response.headers.get("ETag") ?? ""; photosIssuedAt.current = Date.now();
    } catch (error) { if (!abort.signal.aborted && requestRevision === revision.current) setError((error as Error).message || "연결을 확인하고 다시 시도해 주세요."); }
    finally { if (requestRevision === revision.current) setLoading(false); }
  }, [groupId, initialData.demoMode, viewerId]);
  useEffect(() => {
    etag.current = (initialData.activeGroupId ?? initialData.groups[0]?.id) === groupId ? initialData.etag ?? "" : ""; revision.current++;
    const timer = setTimeout(() => { if (!initialData.demoMode) { setLoading(true); void refresh(); } }, 0);
    const sync = () => { void refresh(); };
    const interval = setInterval(sync, 10000);
    window.addEventListener("focus", sync); window.addEventListener("online", sync); document.addEventListener("visibilitychange", sync);
    const invalidate = () => { revision.current++; };
    return () => { clearTimeout(timer); clearInterval(interval); invalidate(); controller.current?.abort(); window.removeEventListener("focus", sync); window.removeEventListener("online", sync); document.removeEventListener("visibilitychange", sync); };
  }, [groupId, initialData.demoMode, initialData.activeGroupId, initialData.groups, initialData.etag, refresh]);
  return { visits, setVisits, groups, setGroups, members, refresh, error, photoWarning, loading };
}
