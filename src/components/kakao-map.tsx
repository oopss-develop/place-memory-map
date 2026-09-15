"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { Visit } from "@/types/domain";

declare global { interface Window { kakao?: any; } }

function markerImage(color: string, highlighted: boolean) {
  const width = highlighted ? 46 : 34;
  const height = highlighted ? 58 : 44;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 40 52"><path d="M20 2C10.6 2 3 9.6 3 19c0 12.8 17 30.8 17 30.8S37 31.8 37 19C37 9.6 29.4 2 20 2Z" fill="${color}" stroke="#fffdf6" stroke-width="2.5"/><circle cx="20" cy="19" r="6" fill="#fffdf6"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

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
      const selected = selectedId === visit.id;
      const markerWidth = highlighted ? 46 : 34;
      const markerHeight = highlighted ? 58 : 44;
      const imageSize = new window.kakao.maps.Size(markerWidth, markerHeight);
      const image = new window.kakao.maps.MarkerImage(
        markerImage(highlighted ? "#d84c32" : selected ? "#a93324" : "#4d89ad", highlighted),
        imageSize,
        { offset: new window.kakao.maps.Point(markerWidth / 2, markerHeight) },
      );
      const marker = new window.kakao.maps.Marker({
        map: mapRef.current,
        position: new window.kakao.maps.LatLng(visit.place.latitude, visit.place.longitude),
        image,
        clickable: true,
        zIndex: highlighted ? 3 : selected ? 2 : 1,
      });
      window.kakao.maps.event.addListener(marker, "click", () => onSelect(visit));
      return marker;
    });
  }, [ready, visits, onSelect, selectedId, highlightedIds]);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.kakao || !visits.length) return;
    const visibleVisits = highlightedIds.length
      ? visits.filter((visit) => highlightedIds.includes(visit.id))
      : visits;
    if (!visibleVisits.length) return;
    const selectedVisit = visits.find((visit) => visit.id === selectedId);
    if (selectedVisit) {
      mapRef.current.setCenter(new window.kakao.maps.LatLng(selectedVisit.place.latitude, selectedVisit.place.longitude));
      mapRef.current.setLevel(5);
      return;
    }
    if (visibleVisits.length === 1) {
      const visit = visibleVisits[0];
      mapRef.current.setCenter(new window.kakao.maps.LatLng(visit.place.latitude, visit.place.longitude));
      mapRef.current.setLevel(5);
      return;
    }
    const bounds = new window.kakao.maps.LatLngBounds();
    visibleVisits.forEach((visit) => bounds.extend(new window.kakao.maps.LatLng(visit.place.latitude, visit.place.longitude)));
    mapRef.current.setBounds(bounds, 72, 72, 72, 72);
  }, [ready, visits, selectedId, highlightedIds]);

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
