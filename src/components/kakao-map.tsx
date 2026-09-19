"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { markerSvgDataUrl, normalizeMarkerStyle } from "@/lib/marker-styles";
import type { Visit } from "@/types/domain";
import { OpenStreetMap } from "@/components/osm-map";

declare global { interface Window { kakao?: any; } }

interface Props {
  visits: Visit[];
  mapProvider: "kakao" | "osm";
  selectedId?: string;
  selectionRequest: number;
  manualMode: boolean;
  onSelect: (visit: Visit) => void;
  onAnchorChange?: (anchor?: MapAnchor) => void;
  onDismissPopup?: () => void;
  onManualPoint: (latitude: number, longitude: number) => void;
  focusLocation?: { latitude: number; longitude: number };
  mapFocus?: { latitude: number; longitude: number };
  maxZoomRequest?: { latitude: number; longitude: number; request: number };
  pulseLocation?: { latitude: number; longitude: number };
  highlightedIds?: string[];
}

export interface MapAnchor {
  x: number;
  y: number;
  topY?: number;
}

// Kakao Maps uses level 1 for its maximum zoom; level 3 is two steps wider.
const SEARCH_FOCUS_LEVEL = 3;
const FALLBACK_MAP_BOUNDS = { minLatitude: 37.5, maxLatitude: 37.61, minLongitude: 126.91, maxLongitude: 127.09 };

function fallbackMapPosition(latitude: number, longitude: number) {
  const left = 13 + ((longitude - FALLBACK_MAP_BOUNDS.minLongitude) / (FALLBACK_MAP_BOUNDS.maxLongitude - FALLBACK_MAP_BOUNDS.minLongitude)) * 74;
  const top = 10 + ((FALLBACK_MAP_BOUNDS.maxLatitude - latitude) / (FALLBACK_MAP_BOUNDS.maxLatitude - FALLBACK_MAP_BOUNDS.minLatitude)) * 74;
  return { left: Math.max(8, Math.min(88, left)), top: Math.max(8, Math.min(84, top)) };
}

export function KakaoMap({ visits, mapProvider, selectedId, selectionRequest, manualMode, onSelect, onAnchorChange, onDismissPopup, onManualPoint, focusLocation, mapFocus, maxZoomRequest, pulseLocation, highlightedIds = [] }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const clustererRef = useRef<any>(null);
  const pulseOverlayRef = useRef<any>(null);
  const bounceOverlayRef = useRef<any>(null);
  const lastSelectedIdRef = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY;
  const selectedVisit = visits.find((visit) => visit.id === selectedId);
  const pulseTarget = selectedVisit?.place ?? pulseLocation;
  const pulseLatitude = pulseTarget?.latitude;
  const pulseLongitude = pulseTarget?.longitude;
  const pulseMarkerStyle = selectedVisit?.markerStyle;

  useEffect(() => {
    if (!apiKey || !ref.current) return;
    const boot = () => window.kakao?.maps.load(() => {
      if (!ref.current) return;
      mapRef.current = new window.kakao.maps.Map(ref.current, { center: new window.kakao.maps.LatLng(37.5665, 126.978), level: 8 });
      if (window.kakao.maps.MarkerClusterer) {
        clustererRef.current = new window.kakao.maps.MarkerClusterer({
          map: mapRef.current,
          averageCenter: true,
          minLevel: 6,
          disableClickZoom: false,
          styles: [{
            width: "44px",
            height: "44px",
            lineHeight: "44px",
            borderRadius: "50%",
            color: "#fffdf6",
            background: "#162d38",
            textAlign: "center",
            fontWeight: "800",
            boxShadow: "0 4px 10px rgba(22,45,56,.25)",
          }],
        });
      }
      setReady(true);
    });
    if (window.kakao?.maps) { boot(); return; }
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=clusterer`;
    script.async = true;
    script.onload = boot;
    document.head.appendChild(script);
    return () => { script.onload = null; };
  }, [apiKey]);

  useEffect(() => {
    // 선택 핀의 파동 효과는 잠시 비활성화합니다. 선택된 핀 자체의 바운스만 사용합니다.
    return;
    /*
    const removePulse = () => {
      pulseOverlayRef.current?.setMap(null);
      pulseOverlayRef.current = null;
    };

    if (!apiKey || !ready || !mapRef.current || !window.kakao || pulseLatitude === undefined || pulseLongitude === undefined) {
      removePulse();
      return;
    }

    const content = document.createElement("span");
    content.className = "map-pin-pulse";
    content.setAttribute("aria-hidden", "true");
    const image = document.createElement("img");
    image.src = markerSvgDataUrl(pulseMarkerStyle);
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    content.append(image);
    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(pulseLatitude, pulseLongitude),
      content,
      xAnchor: 0.5,
      yAnchor: 1,
      zIndex: 1,
      clickable: false,
    });
    overlay.setMap(mapRef.current);
    pulseOverlayRef.current = overlay;

    return removePulse;
    */
  }, [apiKey, pulseLatitude, pulseLongitude, pulseMarkerStyle, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.kakao) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    clustererRef.current?.clear();
    markersRef.current = visits.map((visit) => {
      const highlighted = highlightedIds.includes(visit.id);
      const selected = selectedId === visit.id;
      const markerSize = highlighted ? 48 : 44;
      const imageSize = new window.kakao.maps.Size(markerSize, markerSize);
      const image = new window.kakao.maps.MarkerImage(
        markerSvgDataUrl(visit.markerStyle, { highlighted, selected }),
        imageSize,
        { offset: new window.kakao.maps.Point(markerSize / 2, markerSize) },
      );
      const marker = new window.kakao.maps.Marker({
        map: clustererRef.current ? null : mapRef.current,
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
    clustererRef.current?.addMarkers(markersRef.current);
  }, [ready, visits, onSelect, selectedId, highlightedIds]);

  useEffect(() => {
    const removeBounce = () => {
      bounceOverlayRef.current?.setMap(null);
      bounceOverlayRef.current = null;
    };

    if (!ready || !selectedId || !mapRef.current || !window.kakao || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      removeBounce();
      return;
    }
    const visitIndex = visits.findIndex((visit) => visit.id === selectedId);
    const selectedMarker = visitIndex >= 0 ? markersRef.current[visitIndex] : undefined;
    const selectedVisit = visits[visitIndex];
    if (!selectedMarker || !selectedVisit) return;

    const markerSize = highlightedIds.includes(selectedVisit.id) ? 48 : 44;
    const content = document.createElement("span");
    content.className = "map-marker-bounce-overlay";
    content.style.width = `${markerSize}px`;
    content.style.height = `${markerSize}px`;
    content.setAttribute("aria-hidden", "true");
    const image = document.createElement("img");
    image.src = markerSvgDataUrl(selectedVisit.markerStyle, { highlighted: highlightedIds.includes(selectedVisit.id), selected: true });
    image.alt = "";
    content.append(image);
    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(selectedVisit.place.latitude, selectedVisit.place.longitude),
      content,
      xAnchor: 0.5,
      yAnchor: 1,
      zIndex: 4,
      clickable: false,
    });
    selectedMarker.setOpacity(0);
    overlay.setMap(mapRef.current);
    bounceOverlayRef.current = overlay;

    return () => {
      removeBounce();
      selectedMarker.setOpacity(1);
    };
  }, [highlightedIds, ready, selectedId, visits]);

  useEffect(() => {
    if (!visits.length) return;
    const previousSelectedId = lastSelectedIdRef.current;
    const wasSelected = Boolean(previousSelectedId && visits.some((visit) => visit.id === previousSelectedId));
    lastSelectedIdRef.current = selectedId;
    if (mapFocus) return;
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
        const markerHeight = highlightedIds.includes(selectedVisit.id) ? 48 : 44;
        const mapElement = ref.current;
        if (!mapElement || point.x < 0 || point.x > mapElement.clientWidth || point.y < 0 || point.y > mapElement.clientHeight) {
          onDismissPopup?.();
          return;
        }
        onAnchorChange?.({ x: point.x, y: point.y, topY: point.y - markerHeight });
      };
      window.kakao.maps.event.addListener(mapRef.current, "idle", reveal);
      const markerPosition = new window.kakao.maps.LatLng(selectedVisit.place.latitude, selectedVisit.place.longitude);
      const projection = mapRef.current.getProjection();
      const markerPoint = projection.pointFromCoords(markerPosition);
      let targetCenter = markerPosition;
      if (ref.current) {
        const mapHeight = ref.current.clientHeight;
        if (window.innerWidth <= 820) {
          const visibleMarkerY = Math.max(132, Math.min(Math.round(mapHeight * 0.28), 250));
          const centerOffset = Math.round(mapHeight / 2 - visibleMarkerY);
          targetCenter = projection.coordsFromPoint(new window.kakao.maps.Point(
            markerPoint.x,
            markerPoint.y + centerOffset,
          ));
        } else {
          targetCenter = projection.coordsFromPoint(new window.kakao.maps.Point(
            markerPoint.x,
            markerPoint.y - Math.round(mapHeight * 0.32),
          ));
        }
      }
      const currentCenterPoint = projection.pointFromCoords(mapRef.current.getCenter());
      const targetCenterPoint = projection.pointFromCoords(targetCenter);
      const alreadySettled = Math.abs(currentCenterPoint.x - targetCenterPoint.x) < 1
        && Math.abs(currentCenterPoint.y - targetCenterPoint.y) < 1;
      const revealFrame = alreadySettled ? window.requestAnimationFrame(reveal) : undefined;
      if (!alreadySettled) mapRef.current.panTo(targetCenter);
      const fallbackTimer = window.setTimeout(reveal, 700);
      return () => {
        if (revealFrame !== undefined) window.cancelAnimationFrame(revealFrame);
        window.clearTimeout(fallbackTimer);
        if (!completed) window.kakao.maps.event.removeListener(mapRef.current, "idle", reveal);
      };
    }
    // Closing the detail sheet should leave the map where the sheet interaction
    // positioned it. Re-fitting bounds here jumps back to the pre-selection view.
    if (!selectedId && wasSelected) return;
    if (!ready || !mapRef.current || !window.kakao) return;
    if (visibleVisits.length === 1) {
      const visit = visibleVisits[0];
      mapRef.current.setCenter(new window.kakao.maps.LatLng(visit.place.latitude, visit.place.longitude));
      return;
    }
    const bounds = new window.kakao.maps.LatLngBounds();
    visibleVisits.forEach((visit) => bounds.extend(new window.kakao.maps.LatLng(visit.place.latitude, visit.place.longitude)));
    mapRef.current.setBounds(bounds, 72, 72, 72, 72);
  }, [apiKey, highlightedIds, mapFocus, onAnchorChange, onDismissPopup, ready, selectedId, selectionRequest, visits]);

  useEffect(() => {
    if (!selectedId || !onAnchorChange) return;
    if (apiKey && ready && mapRef.current && window.kakao) {
      const update = () => {
        const visit = visits.find((item) => item.id === selectedId);
        if (!visit) return onAnchorChange();
        const point = mapRef.current.getProjection().containerPointFromCoords(new window.kakao.maps.LatLng(visit.place.latitude, visit.place.longitude));
        const markerHeight = highlightedIds.includes(visit.id) ? 48 : 44;
        const mapElement = ref.current;
        if (!mapElement || point.x < 0 || point.x > mapElement.clientWidth || point.y < 0 || point.y > mapElement.clientHeight) {
          onDismissPopup?.();
          return;
        }
        onAnchorChange({ x: point.x, y: point.y, topY: point.y - markerHeight });
      };
      const idleHandler = () => update();
      window.kakao.maps.event.addListener(mapRef.current, "idle", idleHandler);
      return () => window.kakao.maps.event.removeListener(mapRef.current, "idle", idleHandler);
    }
    return;
  }, [apiKey, highlightedIds, onAnchorChange, onDismissPopup, ready, selectedId, visits]);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.kakao || !manualMode) return;
    const handler = (event: any) => onManualPoint(event.latLng.getLat(), event.latLng.getLng());
    window.kakao.maps.event.addListener(mapRef.current, "click", handler);
    return () => window.kakao.maps.event.removeListener(mapRef.current, "click", handler);
  }, [manualMode, onManualPoint, ready]);

  useEffect(() => {
    if (!focusLocation || !ready || !mapRef.current || !window.kakao) return;
    mapRef.current.setLevel(SEARCH_FOCUS_LEVEL);
    mapRef.current.panTo(new window.kakao.maps.LatLng(focusLocation.latitude, focusLocation.longitude));
  }, [focusLocation, ready]);

  useEffect(() => {
    if (!mapFocus || !ready || !mapRef.current || !window.kakao) return;
    mapRef.current.setLevel(SEARCH_FOCUS_LEVEL);
    mapRef.current.panTo(new window.kakao.maps.LatLng(mapFocus.latitude, mapFocus.longitude));
  }, [mapFocus, ready]);

  useEffect(() => {
    if (!maxZoomRequest || !ready || !mapRef.current || !window.kakao) return;
    const target = new window.kakao.maps.LatLng(maxZoomRequest.latitude, maxZoomRequest.longitude);
    mapRef.current.setLevel(1);
    mapRef.current.panTo(target);
  }, [maxZoomRequest, ready]);

  function fallbackClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!manualMode) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    onManualPoint(37.61 - y * 0.11, 126.91 + x * 0.18);
  }

  if (mapProvider === "osm") {
    return <OpenStreetMap visits={visits} selectedId={selectedId} manualMode={manualMode} onSelect={onSelect} onAnchorChange={onAnchorChange} onDismissPopup={onDismissPopup} onManualPoint={onManualPoint} focusLocation={focusLocation} mapFocus={mapFocus} maxZoomRequest={maxZoomRequest} highlightedIds={highlightedIds} />;
  }

  return (
    <div className={`map-canvas ${manualMode ? "is-pinning" : ""}`} data-zoom-mode={maxZoomRequest ? "max" : undefined} onClick={!apiKey ? fallbackClick : undefined}>
      <div ref={ref} className="kakao-map" />
      {!apiKey && (
        <div className="map-fallback" aria-label="서울 방문 기록 데모 지도">
          <div className="river" /><div className="road road-a" /><div className="road road-b" /><div className="road road-c" />
          <span className="district district-west">종로</span><span className="district district-east">성수</span><span className="district district-south">한강</span>
          {/* Disabled ripple feedback; the selected pin now bounces in place. */}
          {/* {pulseTarget && (() => {
            const position = fallbackMapPosition(pulseTarget.latitude, pulseTarget.longitude);
            return <span className="map-focus-pulse" aria-hidden="true" style={{ left: `${position.left}%`, top: `${position.top}%` }}><img src={markerSvgDataUrl(pulseMarkerStyle)} alt="" /></span>;
          })()} */}
          {visits.map((visit) => {
            const position = fallbackMapPosition(visit.place.latitude, visit.place.longitude);
            const highlighted = highlightedIds.includes(visit.id);
            return <button key={visit.id} data-visit-id={visit.id} data-marker-style={normalizeMarkerStyle(visit.markerStyle)} className={`map-pin ${highlighted ? "highlighted" : ""} ${selectedId === visit.id ? "selected" : ""}`} style={{ left: `${position.left}%`, top: `${position.top}%` }} onClick={(event) => { event.stopPropagation(); onSelect(visit); }} aria-label={`${visit.place.name} 기록 보기`}><img src={markerSvgDataUrl(visit.markerStyle, { highlighted, selected: selectedId === visit.id })} alt="" /></button>;
          })}
          {focusLocation && <span className="current-location-dot" aria-label="현재 위치" />}
          <div className="demo-map-note">Kakao Map 키 연결 전 데모 지도</div>
        </div>
      )}
      {manualMode && <div className="pinning-hint"><MapPin size={17} /> 기록할 위치를 지도에서 선택하세요</div>}
    </div>
  );
}
