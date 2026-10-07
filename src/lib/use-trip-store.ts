"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { clearUserDrafts } from "./drafts";
import { apiRequest, jsonRequest } from "./api-request";
import { fitsTrip } from "@/lib/timetable";
import type { ScheduleItem, Trip } from "@/types/domain";

interface Store { trips: Trip[]; items: ScheduleItem[] }
export async function tripRequest(url: string, method = "GET", body?: unknown) {
  return apiRequest<{ trips: Trip[]; items: ScheduleItem[]; trip: Trip; savedTripId?: string }>(url, jsonRequest(method, body));
}
export function useTripStore(groupId: string, demo: boolean, selectedTripId = "", viewerId = "demo") {
  const [store, setStore] = useState<Store>({ trips: [], items: [] });
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accessLost, setAccessLost] = useState(false);
  const [busy, setBusy] = useState(false);
  const state = useRef(store);
  const writing = useRef(false);
  const foregroundLoading = useRef(false);
  const revision = useRef(0);
  const key = demo ? `place-memory-trips-v1:${groupId}` : `${viewerId}:trips:${groupId}`;
  const pendingRequests = useRef(new Map<string, string>());
  const requestFor = (input: unknown) => { const key = JSON.stringify(input); const previous = pendingRequests.current.get(key); const id = previous ?? crypto.randomUUID(); pendingRequests.current.set(key, id); return id; };
  const commit = useCallback((next: Store, persist = false) => {
    if (persist) localStorage.setItem(key, JSON.stringify(next));
    state.current = next; setStore(next);
  }, [key]);
  const refresh = useCallback(async ({ background = false } = {}) => {
    if (demo || writing.current || (background && foregroundLoading.current)) return;
    const requestRevision = ++revision.current;
    foregroundLoading.current = !background;
    setLoading(!background);
    try {
      const { trips } = await tripRequest(`/api/trips?groupId=${encodeURIComponent(groupId)}`);
      if (requestRevision !== revision.current || writing.current) return;
      const active = trips.find(trip => trip.id === selectedTripId) ?? trips[0];
      const response = active ? await tripRequest(`/api/trips/${active.id}/items`) : null;
      if (requestRevision !== revision.current || writing.current) return;
      commit({ trips: trips.map(trip => trip.id === response?.trip.id ? response.trip : trip), items: response?.items ?? [] });
      setError(""); setAccessLost(false);
    } catch (error) {
      if (requestRevision !== revision.current) return;
      if ([401, 403].includes((error as { status?: number }).status ?? 0)) {
        commit({ trips: [], items: [] }); setAccessLost(true); clearUserDrafts(viewerId);
      }
      throw error;
    } finally { if (requestRevision === revision.current) { foregroundLoading.current = false; setLoading(false); } }
  }, [demo, groupId, selectedTripId, viewerId, commit]);
  useEffect(() => {
    let alive = true;
    const invalidatePendingReads = () => { revision.current++; foregroundLoading.current = false; };
    async function init() {
      try {
        if (demo) {
          const saved = localStorage.getItem(key);
          if (saved) { const parsed = JSON.parse(saved) as Store; if (!Array.isArray(parsed.trips) || !Array.isArray(parsed.items)) throw new Error("저장된 여행 데이터를 읽지 못했습니다."); commit(parsed); }
        } else await refresh();
      } catch (error) { if (alive) setError((error as Error).message); }
      finally { if (alive) setReady(true); }
    }
    void init();
    const sync = () => { if (document.visibilityState === "visible" && navigator.onLine) void refresh({ background: true }).catch((error) => { if (alive) setError(error.message); }); };
    const interval = window.setInterval(sync, 10000);
    window.addEventListener("focus", sync); window.addEventListener("online", sync); document.addEventListener("visibilitychange", sync);
    return () => { alive = false; invalidatePendingReads(); clearInterval(interval); window.removeEventListener("focus", sync); window.removeEventListener("online", sync); document.removeEventListener("visibilitychange", sync); };
  }, [commit, demo, key, refresh]);

  async function mutate(operation: () => Promise<void>) {
    if (writing.current) throw new Error("저장 중입니다. 잠시 기다려 주세요.");
    writing.current = true; revision.current++; foregroundLoading.current = false; setLoading(false); setBusy(true);
    try { await operation(); }
    catch (error) {
      if ((error as { status?: number }).status === 409) {
        writing.current = false;
        await refresh().catch(() => undefined);
      }
      throw error;
    } finally { writing.current = false; setBusy(false); }
  }
  async function saveTrip(input: Omit<Trip, "id"> & { id?: string; requestId?: string }) {
    let id = input.id;
    await mutate(async () => {
      if (demo) {
        if (state.current.items.some((item) => item.tripId === input.id && !fitsTrip(item, input))) throw new Error("새 여행 기간 밖의 일정을 먼저 옮기거나 삭제해 주세요.");
        id ??= crypto.randomUUID();
        const next = { ...input, id, version: input.id ? input.version + 1 : 1 } as Trip;
        commit({ ...state.current, trips: [...state.current.trips.filter((trip) => trip.id !== id), next] }, true);
      } else {
        const data = await tripRequest("/api/trips", input.id ? "PUT" : "POST", { ...input, requestId: input.requestId ?? requestFor(input) });
        pendingRequests.current.delete(JSON.stringify(input));
        id = data.savedTripId;
        commit({ ...state.current, trips: data.trips });
      }
    });
    return id;
  }
  async function deleteTrip(trip: Trip) {
    await mutate(async () => {
      if (!demo) await tripRequest("/api/trips", "DELETE", { id: trip.id, version: trip.version });
      commit({ trips: state.current.trips.filter((value) => value.id !== trip.id), items: state.current.items.filter((item) => item.tripId !== trip.id) }, demo);
    });
  }
  async function saveItem(trip: Trip, input: Omit<ScheduleItem, "id"> & { id?: string; requestId?: string }, newPlace = false) {
    await mutate(async () => {
      if (!fitsTrip(input, trip)) throw new Error("일정은 여행 기간 안에 있어야 하며 종료는 시작 이후여야 합니다.");
      if (demo) {
        const id = input.id ?? crypto.randomUUID();
        const item = { ...input, id, version: input.id ? input.version + 1 : 1 } as ScheduleItem;
        commit({ trips: state.current.trips.map((value) => value.id === trip.id ? { ...value, version: value.version + 1 } : value), items: [...state.current.items.filter((value) => value.id !== id), item] }, true);
      } else {
        const payload = { ...input, requestId: input.requestId ?? requestFor(input), place: { ...input.place, ...(newPlace ? { id: undefined } : {}) } };
        const data = await tripRequest(`/api/trips/${trip.id}/items`, input.id ? "PUT" : "POST", payload);
        pendingRequests.current.delete(JSON.stringify(input));
        commit({ trips: state.current.trips.map((value) => value.id === trip.id ? data.trip : value), items: [...state.current.items.filter((value) => value.tripId !== trip.id), ...data.items] });
      }
    });
  }
  async function deleteItem(trip: Trip, item: ScheduleItem) {
    await mutate(async () => {
      if (demo) commit({ trips: state.current.trips.map((value) => value.id === trip.id ? { ...value, version: value.version + 1 } : value), items: state.current.items.filter((value) => value.id !== item.id) }, true);
      else {
        const data = await tripRequest(`/api/trips/${trip.id}/items`, "DELETE", { id: item.id, version: item.version });
        commit({ trips: state.current.trips.map((value) => value.id === trip.id ? data.trip : value), items: [...state.current.items.filter((value) => value.tripId !== trip.id), ...data.items] });
      }
    });
  }
  return { ...store, ready, loading, error, busy, accessLost, refresh, saveTrip, deleteTrip, saveItem, deleteItem };
}
