"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fitsTrip } from "@/lib/timetable";
import type { ScheduleItem, Trip } from "@/types/domain";

interface Store { trips: Trip[]; items: ScheduleItem[] }
export async function tripRequest(url: string, method = "GET", body?: unknown) {
  const response = await fetch(url, { method, cache: "no-store", ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error ?? "요청을 처리하지 못했습니다."), { status: response.status });
  return data;
}
export function useTripStore(groupId: string, demo: boolean) {
  const [store, setStore] = useState<Store>({ trips: [], items: [] });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const state = useRef(store);
  const writing = useRef(false);
  const revision = useRef(0);
  const key = `place-memory-trips-v1:${groupId}`;
  const commit = useCallback((next: Store, persist = false) => {
    if (persist) localStorage.setItem(key, JSON.stringify(next));
    state.current = next; setStore(next);
  }, [key]);
  const refresh = useCallback(async () => {
    if (demo || writing.current) return;
    const requestRevision = ++revision.current;
    const { trips } = await tripRequest(`/api/trips?groupId=${encodeURIComponent(groupId)}`) as { trips: Trip[] };
    const responses = await Promise.all(trips.map((trip) => tripRequest(`/api/trips/${trip.id}/items`)));
    if (requestRevision !== revision.current || writing.current) return;
    commit({ trips: responses.map((response) => response.trip), items: responses.flatMap((response) => response.items) }); setError("");
  }, [demo, groupId, commit]);
  useEffect(() => {
    let alive = true;
    const invalidatePendingReads = () => { revision.current++; };
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
    const sync = () => { if (document.visibilityState === "visible" && navigator.onLine) void refresh().catch((error) => { if (alive) setError(error.message); }); };
    const interval = window.setInterval(sync, 10000);
    window.addEventListener("focus", sync); window.addEventListener("online", sync); document.addEventListener("visibilitychange", sync);
    return () => { alive = false; invalidatePendingReads(); clearInterval(interval); window.removeEventListener("focus", sync); window.removeEventListener("online", sync); document.removeEventListener("visibilitychange", sync); };
  }, [commit, demo, key, refresh]);

  async function mutate(operation: () => Promise<void>) {
    if (writing.current) throw new Error("저장 중입니다. 잠시 기다려 주세요.");
    writing.current = true; revision.current++; setBusy(true);
    try { await operation(); }
    catch (error) {
      if ((error as { status?: number }).status === 409) {
        writing.current = false;
        await refresh().catch(() => undefined);
      }
      throw error;
    } finally { writing.current = false; setBusy(false); }
  }
  async function saveTrip(input: Omit<Trip, "id"> & { id?: string }) {
    let id = input.id;
    await mutate(async () => {
      if (demo) {
        if (state.current.items.some((item) => item.tripId === input.id && !fitsTrip(item, input))) throw new Error("새 여행 기간 밖의 일정을 먼저 옮기거나 삭제해 주세요.");
        id ??= crypto.randomUUID();
        const next = { ...input, id, version: input.id ? input.version + 1 : 1 } as Trip;
        commit({ ...state.current, trips: [...state.current.trips.filter((trip) => trip.id !== id), next] }, true);
      } else {
        const data = await tripRequest("/api/trips", input.id ? "PUT" : "POST", input);
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
  async function saveItem(trip: Trip, input: Omit<ScheduleItem, "id"> & { id?: string }, newPlace = false) {
    await mutate(async () => {
      if (!fitsTrip(input, trip)) throw new Error("일정은 여행 기간 안에 있어야 하며 종료는 시작 이후여야 합니다.");
      if (demo) {
        const id = input.id ?? crypto.randomUUID();
        const item = { ...input, id, version: input.id ? input.version + 1 : 1 } as ScheduleItem;
        commit({ trips: state.current.trips.map((value) => value.id === trip.id ? { ...value, version: value.version + 1 } : value), items: [...state.current.items.filter((value) => value.id !== id), item] }, true);
      } else {
        const payload = { ...input, place: { ...input.place, ...(newPlace ? { id: undefined } : {}) } };
        const data = await tripRequest(`/api/trips/${trip.id}/items`, input.id ? "PUT" : "POST", payload);
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
  return { ...store, ready, error, busy, refresh, saveTrip, deleteTrip, saveItem, deleteItem };
}
