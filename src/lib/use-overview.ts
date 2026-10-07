"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { aggregateOverview, overviewVisit, type OverviewData, type OverviewPeriod } from "./overview";
import { demoGroups, demoVisits } from "./demo-data";
import type { Group, Trip, Visit } from "@/types/domain";

export function useOverview(userId: string, demo: boolean, groupId: string | undefined, period: OverviewPeriod, recentLimit = 6) {
  const key = `${userId}:${groupId ?? "all"}:${period}`;
  const [state, setState] = useState<{ key: string; data?: OverviewData; error?: string; loading: boolean }>({ key, loading: true });
  const [scopeOptions, setScopeOptions] = useState<{ userId: string; groups: Group[] }>({ userId, groups: [] });
  const request = useRef(0), controller = useRef<AbortController | null>(null);
  const cached = useRef<{ key: string; data?: OverviewData; etag: string; issuedAt: number; recentLimit?: number }>({ key: "", etag: "", issuedAt: 0 });
  const refresh = useCallback(async () => {
    if (!navigator.onLine) { request.current++; controller.current?.abort(); setState({ key, data: cached.current.key === key ? cached.current.data : undefined, loading: false, error: "오프라인입니다. 연결이 돌아오면 자동으로 다시 불러옵니다." }); return; }
    if (document.visibilityState === "hidden") return;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const revision = ++request.current;
    if (cached.current.key !== key) cached.current = { key, etag: "", issuedAt: 0 };
    setState({ key, data: cached.current.data, loading: true });
    try {
      let data: OverviewData;
      if (demo) {
        const groups = JSON.parse(localStorage.getItem("place-memory-groups-v1") ?? "null") as Group[] | null;
        const visits = JSON.parse(localStorage.getItem("place-memory-visits-v2") ?? "null") as Visit[] | null;
        const allowed = groups ?? demoGroups;
        if (groupId && !allowed.some(group => group.id === groupId)) throw Object.assign(new Error("이 지도의 접근 권한이 없습니다."), { status: 403 });
        const trips = allowed.flatMap(group => (JSON.parse(localStorage.getItem(`place-memory-trips-v1:${group.id}`) ?? "null") as { trips: Trip[] } | null)?.trips ?? []);
        data = aggregateOverview(allowed, (visits ?? demoVisits).map(overviewVisit), trips, period, groupId, new Date(), recentLimit);
        const byId = new Map((visits ?? demoVisits).map(visit => [visit.id, visit]));
        data.recentVisits = data.recentVisits.map(recent => ({ ...recent, visit: byId.get(recent.id) }));
      } else {
        const renew = Date.now() - cached.current.issuedAt >= 3540000;
        const params = new URLSearchParams({ period, recentLimit: String(recentLimit) });
        if (groupId) params.set("groupId", groupId);
        if (renew) params.set("renewPhotos", "true");
        const response = await fetch(`/api/overview?${params}`, { signal: abort.signal, cache: "no-store", headers: cached.current.etag && cached.current.recentLimit === recentLimit ? { "If-None-Match": cached.current.etag } : {} });
        if (abort.signal.aborted || request.current !== revision) return;
        if (response.status === 304 && cached.current.data) { setState({ key, data: cached.current.data, loading: false }); return; }
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            cached.current = { key, etag: "", issuedAt: 0 };
            setScopeOptions({ userId, groups: [] });
            setState({ key, loading: false });
          }
          throw Object.assign(new Error(response.status === 401 ? "로그인이 만료되었습니다. 다시 로그인해 주세요." : response.status === 403 ? "이 지도의 접근 권한이 없습니다. 전체 지도로 돌아가 주세요." : "모아보기를 불러오지 못했습니다. 다시 시도해 주세요."), { status: response.status });
        }
        data = await response.json() as OverviewData;
        if (!data.totals || !Array.isArray(data.groups) || !Array.isArray(data.recentVisits)) throw new Error("응답을 확인할 수 없습니다. 다시 시도해 주세요.");
        if (abort.signal.aborted || request.current !== revision) return;
        cached.current.etag = data.photoWarning ? "" : response.headers.get("ETag") ?? "";
        cached.current.issuedAt = Date.now();
      }
      if (abort.signal.aborted || request.current !== revision) return;
      cached.current.data = data;
      cached.current.recentLimit = recentLimit;
      setScopeOptions({ userId, groups: data.groups });
      setState({ key, data, loading: false });
    } catch (error) {
      if (abort.signal.aborted || request.current !== revision) return;
      if ((error as { status?: number }).status === 403) { cached.current = { key, etag: "", issuedAt: 0 }; setScopeOptions({ userId, groups: [] }); }
      const message = error instanceof TypeError ? "네트워크 연결을 확인하고 다시 시도해 주세요." : error instanceof SyntaxError ? "응답을 확인할 수 없습니다. 다시 시도해 주세요." : (error as Error).message;
      setState({ key, data: cached.current.data, loading: false, error: message || "연결을 확인하고 다시 시도해 주세요." });
    }
  }, [demo, groupId, key, period, recentLimit, userId]);
  useEffect(() => {
    const revisions = request;
    const timer = setTimeout(() => void refresh(), 0);
    const sync = () => {
      if (!navigator.onLine || document.visibilityState === "hidden") { request.current++; controller.current?.abort(); }
      if (!navigator.onLine || document.visibilityState !== "hidden") void refresh();
    };
    const interval = setInterval(sync, 30000);
    window.addEventListener("focus", sync); window.addEventListener("online", sync); window.addEventListener("offline", sync); document.addEventListener("visibilitychange", sync);
    return () => { clearTimeout(timer); clearInterval(interval); revisions.current++; controller.current?.abort(); window.removeEventListener("focus", sync); window.removeEventListener("online", sync); window.removeEventListener("offline", sync); document.removeEventListener("visibilitychange", sync); };
  }, [refresh]);
  return { ...(state.key === key ? state : { key, loading: true }), groups: scopeOptions.userId === userId ? scopeOptions.groups : [], refresh };
}
