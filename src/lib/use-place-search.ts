"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "./api-request";
import type { KakaoPlaceResult, Place, Visit } from "@/types/domain";

export type PlaceSearchResult = KakaoPlaceResult & { existingPlace?: Place };
export function localPlaceResults(visits: Visit[], groupId: string, query: string): PlaceSearchResult[] {
  const unique = new Map<string, PlaceSearchResult>();
  for (const visit of visits) {
    if (visit.groupId !== groupId || visit.deletedAt || !visit.place.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())) continue;
    const p = visit.place;
    unique.set(p.id, { id: p.id, placeName: p.name, addressName: p.address, roadAddressName: p.address, categoryName: p.category, latitude: p.latitude, longitude: p.longitude, existingPlace: p });
  }
  return [...unique.values()];
}

export function usePlaceSearch(query: string, provider: "kakao" | "osm", groupId: string, visits: Visit[], active = true) {
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const cancel = useCallback(() => { epoch.current++; controller.current?.abort(); controller.current = null; }, []);
  useEffect(() => {
    cancel();
    const timer = setTimeout(() => { setResults([]); setMessage(""); setSearching(false); }, 0);
    return () => { clearTimeout(timer); cancel(); };
  }, [query, provider, groupId, active, cancel]);
  const search = async () => {
    cancel();
    if (!active) return;
    if (query.trim().length < 2) { setMessage("두 글자 이상 입력해 주세요."); return; }
    const requestEpoch = epoch.current;
    const abort = new AbortController(); controller.current = abort;
    setSearching(true); setMessage("");
    try {
      const data = await apiRequest<{ results: PlaceSearchResult[] }>(`/api/places/search?q=${encodeURIComponent(query.trim())}&map=${provider}`, { signal: abort.signal });
      if (requestEpoch !== epoch.current) return;
      setResults(data.results);
      if (!data.results.length) setMessage("검색 결과가 없어요. 지도에서 직접 선택할 수도 있어요.");
    } catch (error) {
      if (requestEpoch !== epoch.current || abort.signal.aborted) return;
      const local = localPlaceResults(visits, groupId, query.trim());
      setResults(local); setMessage(local.length ? "현재 기록에서 찾았습니다." : (error as Error).message);
    } finally { if (requestEpoch === epoch.current) setSearching(false); }
  };
  return { results, setResults, searching, message, setMessage, search, cancel };
}
