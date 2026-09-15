"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { Visit } from "@/types/domain";

declare global { interface Window { kakao?: any; } }

interface Props {
  visits: Visit[];
  selectedId?: string;
  manualMode: boolean;
  onSelect: (visit: Visit) => void;
  onManualPoint: (latitude: number, longitude: number) => void;
  focusLocation?: { latitude: number; longitude: number };
  highlightedIds?: string[];
}

export function KakaoMap({ visits, selectedId, manualMode, onSelect, onManualPoint, focusLocation, highlightedIds = [] }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY;

  useEffect(() => {
    if (!apiKey || !ref.current) return;
    const boot = () => window.kakao?.maps.load(() => {
      if (!ref.current) return;
      mapRef.current = new window.kakao.maps.Map(ref.current, { center: new window.kakao.maps.LatLng(37.5665, 126.978), level: 8 });
      setReady(true);
    });
    if (window.kakao?.maps) { boot(); return; }
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
    script.async = true;
    script.onload = boot;
    document.head.appendChild(script);
    return () => { script.onload = null; };
  }, [apiKey]);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.kakao) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = visits.map((visit) => {
      const highlighted = highlightedIds.includes(visit.id);
      const element = document.createElement("button");
      element.type = "button";
      element.className = `kakao-pin-overlay ${highlighted ? "highlighted" : ""} ${selectedId === visit.id ? "selected" : ""}`;
      element.setAttribute("aria-label", `${visit.place.name} 기록 보기`);
      element.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" fill="currentColor" stroke="white" stroke-width="1.5"/><circle cx="12" cy="10" r="2.5" fill="white"/></svg>';
      element.addEventListener("click", (event) => { event.stopPropagation(); onSelect(visit); });
      return new window.kakao.maps.CustomOverlay({ map: mapRef.current, position: new window.kakao.maps.LatLng(visit.place.latitude, visit.place.longitude), content: element, yAnchor: 1, zIndex: highlighted ? 3 : 1 });
    });
  }, [ready, visits, onSelect, selectedId, highlightedIds]);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.kakao || !manualMode) return;
    const handler = (event: any) => onManualPoint(event.latLng.getLat(), event.latLng.getLng());
    window.kakao.maps.event.addListener(mapRef.current, "click", handler);
    return () => window.kakao.maps.event.removeListener(mapRef.current, "click", handler);
  }, [manualMode, onManualPoint, ready]);

  useEffect(() => {
    if (!focusLocation || !ready || !mapRef.current || !window.kakao) return;
    mapRef.current.panTo(new window.kakao.maps.LatLng(focusLocation.latitude, focusLocation.longitude));
  }, [focusLocation, ready]);

  function fallbackClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!manualMode) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    onManualPoint(37.61 - y * 0.11, 126.91 + x * 0.18);
  }

  return (
    <div className={`map-canvas ${manualMode ? "is-pinning" : ""}`} onClick={!apiKey ? fallbackClick : undefined}>
      <div ref={ref} className="kakao-map" />
      {!apiKey && (
        <div className="map-fallback" aria-label="서울 방문 기록 데모 지도">
          <div className="river" /><div className="road road-a" /><div className="road road-b" /><div className="road road-c" />
          <span className="district district-west">종로</span><span className="district district-east">성수</span><span className="district district-south">한강</span>
          {visits.map((visit, index) => {
            const left = 13 + ((visit.place.longitude - 126.91) / 0.18) * 74;
            const top = 10 + ((37.61 - visit.place.latitude) / 0.11) * 74;
            const highlighted = highlightedIds.includes(visit.id);
            return <button key={visit.id} className={`map-pin ${highlighted ? "highlighted" : ""} ${selectedId === visit.id ? "selected" : ""}`} style={{ left: `${Math.max(8, Math.min(88, left))}%`, top: `${Math.max(8, Math.min(84, top))}%` }} onClick={(event) => { event.stopPropagation(); onSelect(visit); }} aria-label={`${visit.place.name} 기록 보기`}><MapPin size={highlighted ? 36 : 28} fill="currentColor" strokeWidth={1.6} /><span>{index + 1}</span></button>;
          })}
          {focusLocation && <span className="current-location-dot" aria-label="현재 위치" />}
          <div className="demo-map-note">Kakao Map 키 연결 전 데모 지도</div>
        </div>
      )}
      {manualMode && <div className="pinning-hint"><MapPin size={17} /> 기록할 위치를 지도에서 선택하세요</div>}
    </div>
  );
}
