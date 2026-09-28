"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { markerSvgDataUrl } from "@/lib/marker-styles";
import type { MapPoint } from "@/types/domain";
import type { MapAnchor } from "@/components/kakao-map";
import { MapOfflineFallback } from "@/components/map-offline-fallback";

interface Props<T extends MapPoint> {
  visits: T[];
  selectedId?: string;
  manualMode: boolean;
  onSelect: (visit: T) => void;
  onAnchorChange?: (anchor?: MapAnchor) => void;
  onDismissPopup?: () => void;
  onManualPoint: (latitude: number, longitude: number) => void;
  focusLocation?: { latitude: number; longitude: number };
  mapFocus?: { latitude: number; longitude: number };
  maxZoomRequest?: { latitude: number; longitude: number; request: number };
  highlightedIds?: string[];
}

declare global { interface Window { L?: any; } }

let leafletPromise: Promise<any> | undefined;
const EMPTY_HIGHLIGHTED_IDS: string[] = [];

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector("link[data-leaflet]") ) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.dataset.leaflet = "true";
        document.head.appendChild(link);
      }
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => window.L ? resolve(window.L) : reject(new Error("Leaflet failed to load"));
      script.onerror = () => reject(new Error("Leaflet failed to load"));
      document.head.appendChild(script);
    });
  }
  return leafletPromise;
}

export function OpenStreetMap<T extends MapPoint>({ visits, selectedId, manualMode, onSelect, onAnchorChange, onDismissPopup, onManualPoint, focusLocation, mapFocus, maxZoomRequest, highlightedIds = EMPTY_HIGHLIGHTED_IDS }: Props<T>) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const stateRef = useRef({ visits, selectedId, manualMode, onAnchorChange, onDismissPopup, onManualPoint });

  useEffect(() => {
    stateRef.current = { visits, selectedId, manualMode, onAnchorChange, onDismissPopup, onManualPoint };
  }, [manualMode, onAnchorChange, onDismissPopup, onManualPoint, selectedId, visits]);

  useEffect(() => {
    let disposed = false;
    const timeout = window.setTimeout(() => { if (!disposed) setFailed(true); }, 12000);
    loadLeaflet().then((L) => {
      if (disposed || !elementRef.current || mapRef.current) return;
      const map = L.map(elementRef.current, { zoomControl: false, attributionControl: true }).setView([20, 0], 2);
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
      markerLayerRef.current = L.layerGroup().addTo(map);
      map.on("click", (event: any) => { if (stateRef.current.manualMode) stateRef.current.onManualPoint(event.latlng.lat, event.latlng.lng); });
      map.on("moveend zoomend", () => {
        const current = stateRef.current;
        if (!current.selectedId || !current.onAnchorChange) return;
        const visit = current.visits.find((item) => item.id === current.selectedId);
        if (!visit) return current.onAnchorChange();
        const point = map.latLngToContainerPoint([visit.place.latitude, visit.place.longitude]);
        if (point.x < 0 || point.x > elementRef.current!.clientWidth || point.y < 0 || point.y > elementRef.current!.clientHeight) return current.onDismissPopup?.();
        current.onAnchorChange({ x: point.x, y: point.y, topY: point.y - 44 });
      });
      mapRef.current = map;
      setReady(true);
      setFailed(false); clearTimeout(timeout);
    }).catch(() => { if (!disposed) setFailed(true); leafletPromise = undefined; clearTimeout(timeout); });
    return () => { disposed = true; clearTimeout(timeout); mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L || !markerLayerRef.current) return;
    markerLayerRef.current.clearLayers();
    visits.forEach((visit) => {
      const highlighted = highlightedIds.includes(visit.id);
      const selected = selectedId === visit.id;
      const content = document.createElement("div");
      const image = document.createElement("img");
      image.src = markerSvgDataUrl(visit.markerStyle, { highlighted, selected }); image.alt = ""; content.append(image);
      if (visit.pinLabel) { const label = document.createElement("span"); label.className = "schedule-pin-label"; label.textContent = visit.pinLabel; content.append(label); }
      const icon = L.divIcon({ className: `osm-pin-icon${selected ? " selected" : ""}`, html: content, iconSize: [44, 44], iconAnchor: [22, 44] });
      L.marker([visit.place.latitude, visit.place.longitude], { icon, zIndexOffset: selectedId === visit.id ? 100 : 0 }).on("click", (event: any) => { L.DomEvent.stopPropagation(event); onSelect(visit); }).addTo(markerLayerRef.current);
    });
    if (!selectedId && !mapFocus && visits.length) {
      const bounds = L.latLngBounds(visits.map((visit) => [visit.place.latitude, visit.place.longitude]));
      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 12 });
    }
  }, [highlightedIds, mapFocus, onSelect, ready, selectedId, visits]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const target = mapFocus ?? focusLocation;
    if (target) {
      const zoom = mapFocus ? map.getZoom() : Math.max(map.getMinZoom(), map.getMaxZoom() - 2);
      map.setView([target.latitude, target.longitude], zoom, { animate: true });
    }
    if (selectedId) {
      const visit = visits.find((item) => item.id === selectedId);
      if (visit) map.panTo([visit.place.latitude, visit.place.longitude]);
    }
  }, [focusLocation, mapFocus, ready, selectedId, visits]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !maxZoomRequest) return;
    map.setView(
      [maxZoomRequest.latitude, maxZoomRequest.longitude],
      map.getMaxZoom(),
      { animate: true },
    );
  }, [maxZoomRequest, ready]);

  return <div className={`map-canvas ${manualMode ? "is-pinning" : ""}`} data-zoom-mode={maxZoomRequest ? "max" : undefined}><div ref={elementRef} className="osm-map" aria-label="해외 OpenStreetMap 지도" />{failed && <MapOfflineFallback visits={visits} manualMode={manualMode} onSelect={onSelect} onManualPoint={onManualPoint} />}<div className="osm-map-note">© OpenStreetMap contributors</div>{manualMode && <div className="pinning-hint">지도에서 기록할 위치를 선택하세요</div>}</div>;
}
