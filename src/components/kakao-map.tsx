"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { markerSvgDataUrl, normalizeMarkerStyle } from "@/lib/marker-styles";
import type { Visit } from "@/types/domain";

declare global { interface Window { kakao?: any; } }

interface Props {
  visits: Visit[];
  selectedId?: string;
  selectionRequest: number;
  manualMode: boolean;
  onSelect: (visit: Visit) => void;
  onAnchorChange?: (anchor?: MapAnchor) => void;
  onManualPoint: (latitude: number, longitude: number) => void;
  focusLocation?: { latitude: number; longitude: number };
  highlightedIds?: string[];
}

export interface MapAnchor {
  x: number;
  y: number;
  topY?: number;
}

export function KakaoMap({ visits, selectedId, selectionRequest, manualMode, onSelect, onAnchorChange, onManualPoint, focusLocation, highlightedIds = [] }: Props) {
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
      const markerWidth = highlighted ? 48 : 40;
      const markerHeight = highlighted ? 58 : 48;
      const imageSize = new window.kakao.maps.Size(markerWidth, markerHeight);
      const image = new window.kakao.maps.MarkerImage(
        markerSvgDataUrl(visit.markerStyle, { highlighted, selected }),
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
      window.kakao.maps.event.addListener(marker, "click", () => {
        onSelect(visit);
      });
      return marker;
    });
  }, [ready, visits, onSelect, selectedId, highlightedIds]);

  useEffect(() => {
    if (!visits.length) return;
    const visibleVisits = highlightedIds.length
      ? visits.filter((visit) => highlightedIds.includes(visit.id))
      : visits;
    if (!visibleVisits.length) return;
    const selectedVisit = visits.find((visit) => visit.id === selectedId);
    if (selectedVisit) {
      onAnchorChange?.();
      if (!apiKey) {
        const frame = window.requestAnimationFrame(() => {
          const mapCanvas = ref.current?.parentElement;
          const marker = mapCanvas?.querySelector(`[data-visit-id="${selectedVisit.id}"]`) as HTMLElement | null;
          if (!mapCanvas || !marker) return;
          const mapRect = mapCanvas.getBoundingClientRect();
          const markerRect = marker.getBoundingClientRect();
          onAnchorChange?.({ x: markerRect.left + markerRect.width / 2 - mapRect.left, y: markerRect.bottom - mapRect.top, topY: markerRect.top - mapRect.top });
        });
        return () => window.cancelAnimationFrame(frame);
      }
      if (!ready || !mapRef.current || !window.kakao) return;
      let completed = false;
      const reveal = () => {
        if (completed) return;
        completed = true;
        window.kakao.maps.event.removeListener(mapRef.current, "idle", reveal);
        const point = mapRef.current.getProjection().containerPointFromCoords(new window.kakao.maps.LatLng(selectedVisit.place.latitude, selectedVisit.place.longitude));
        const markerHeight = highlightedIds.includes(selectedVisit.id) ? 58 : 48;
        onAnchorChange?.({ x: point.x, y: point.y, topY: point.y - markerHeight });
      };
      window.kakao.maps.event.addListener(mapRef.current, "idle", reveal);
      mapRef.current.setCenter(new window.kakao.maps.LatLng(selectedVisit.place.latitude, selectedVisit.place.longitude));
      if (window.innerWidth > 820 && ref.current) {
        mapRef.current.panBy(0, -Math.round(ref.current.clientHeight * 0.32));
      }
      const fallbackTimer = window.setTimeout(reveal, 700);
      return () => {
        window.clearTimeout(fallbackTimer);
        if (!completed) window.kakao.maps.event.removeListener(mapRef.current, "idle", reveal);
      };
    }
    if (!ready || !mapRef.current || !window.kakao) return;
    if (visibleVisits.length === 1) {
      const visit = visibleVisits[0];
      mapRef.current.setCenter(new window.kakao.maps.LatLng(visit.place.latitude, visit.place.longitude));
      return;
    }
    const bounds = new window.kakao.maps.LatLngBounds();
    visibleVisits.forEach((visit) => bounds.extend(new window.kakao.maps.LatLng(visit.place.latitude, visit.place.longitude)));
    mapRef.current.setBounds(bounds, 72, 72, 72, 72);
  }, [apiKey, highlightedIds, onAnchorChange, ready, selectedId, selectionRequest, visits]);

  useEffect(() => {
    if (!selectedId || !onAnchorChange) return;
    if (apiKey && ready && mapRef.current && window.kakao) {
      const update = () => {
        const visit = visits.find((item) => item.id === selectedId);
        if (!visit) return onAnchorChange();
        const point = mapRef.current.getProjection().containerPointFromCoords(new window.kakao.maps.LatLng(visit.place.latitude, visit.place.longitude));
        const markerHeight = highlightedIds.includes(visit.id) ? 58 : 48;
        onAnchorChange({ x: point.x, y: point.y, topY: point.y - markerHeight });
      };
      const idleHandler = () => update();
      window.kakao.maps.event.addListener(mapRef.current, "idle", idleHandler);
      return () => window.kakao.maps.event.removeListener(mapRef.current, "idle", idleHandler);
    }
    return;
  }, [apiKey, highlightedIds, onAnchorChange, ready, selectedId, visits]);

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
          {visits.map((visit) => {
            const left = 13 + ((visit.place.longitude - 126.91) / 0.18) * 74;
            const top = 10 + ((37.61 - visit.place.latitude) / 0.11) * 74;
            const highlighted = highlightedIds.includes(visit.id);
            return <button key={visit.id} data-visit-id={visit.id} data-marker-style={normalizeMarkerStyle(visit.markerStyle)} className={`map-pin ${highlighted ? "highlighted" : ""} ${selectedId === visit.id ? "selected" : ""}`} style={{ left: `${Math.max(8, Math.min(88, left))}%`, top: `${Math.max(8, Math.min(84, top))}%` }} onClick={(event) => { event.stopPropagation(); onSelect(visit); }} aria-label={`${visit.place.name} 기록 보기`}><img src={markerSvgDataUrl(visit.markerStyle, { highlighted, selected: selectedId === visit.id })} alt="" /></button>;
          })}
          {focusLocation && <span className="current-location-dot" aria-label="현재 위치" />}
          <div className="demo-map-note">Kakao Map 키 연결 전 데모 지도</div>
        </div>
      )}
      {manualMode && <div className="pinning-hint"><MapPin size={17} /> 기록할 위치를 지도에서 선택하세요</div>}
    </div>
  );
}
