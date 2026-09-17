"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useEffect, useRef } from "react";
import { markerSvgDataUrl } from "@/lib/marker-styles";
import type { Visit } from "@/types/domain";
import type { MapAnchor } from "@/components/kakao-map";

interface Props {
  visits: Visit[];
  selectedId?: string;
  manualMode: boolean;
  onSelect: (visit: Visit) => void;
  onAnchorChange?: (anchor?: MapAnchor) => void;
  onDismissPopup?: () => void;
  onManualPoint: (latitude: number, longitude: number) => void;
  focusLocation?: { latitude: number; longitude: number };
  mapFocus?: { latitude: number; longitude: number };
  highlightedIds?: string[];
}

declare global { interface Window { L?: any; } }

let leafletPromise: Promise<any> | undefined;

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

export function OpenStreetMap({ visits, selectedId, manualMode, onSelect, onAnchorChange, onDismissPopup, onManualPoint, focusLocation, mapFocus, highlightedIds = [] }: Props) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);

  useEffect(() => {
    let disposed = false;
    loadLeaflet().then((L) => {
      if (disposed || !elementRef.current || mapRef.current) return;
      const map = L.map(elementRef.current, { zoomControl: false, attributionControl: true }).setView([36.5, 127.8], 5);
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
      markerLayerRef.current = L.layerGroup().addTo(map);
      map.on("click", (event: any) => { if (manualMode) onManualPoint(event.latlng.lat, event.latlng.lng); });
      map.on("moveend zoomend", () => {
        if (!selectedId || !onAnchorChange) return;
        const visit = visits.find((item) => item.id === selectedId);
        if (!visit) return onAnchorChange();
        const point = map.latLngToContainerPoint([visit.place.latitude, visit.place.longitude]);
        if (point.x < 0 || point.x > elementRef.current!.clientWidth || point.y < 0 || point.y > elementRef.current!.clientHeight) return onDismissPopup?.();
        onAnchorChange({ x: point.x, y: point.y, topY: point.y - 44 });
      });
      mapRef.current = map;
    }).catch(() => undefined);
    return () => { disposed = true; mapRef.current?.remove(); mapRef.current = null; };
  }, [onAnchorChange, onDismissPopup, onManualPoint, selectedId, visits, manualMode]);

  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L || !markerLayerRef.current) return;
    markerLayerRef.current.clearLayers();
    visits.forEach((visit) => {
      const highlighted = highlightedIds.includes(visit.id);
      const icon = L.divIcon({ className: "osm-pin-icon", html: `<img src="${markerSvgDataUrl(visit.markerStyle, { highlighted, selected: selectedId === visit.id })}" alt="" />`, iconSize: [44, 44], iconAnchor: [22, 44] });
      L.marker([visit.place.latitude, visit.place.longitude], { icon, zIndexOffset: selectedId === visit.id ? 100 : 0 }).on("click", (event: any) => { L.DomEvent.stopPropagation(event); onSelect(visit); }).addTo(markerLayerRef.current);
    });
  }, [highlightedIds, onSelect, selectedId, visits]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const target = mapFocus ?? focusLocation;
    if (target) map.panTo([target.latitude, target.longitude]);
    if (selectedId) {
      const visit = visits.find((item) => item.id === selectedId);
      if (visit) map.panTo([visit.place.latitude, visit.place.longitude]);
    }
  }, [focusLocation, mapFocus, selectedId, visits]);

  return <div className={`map-canvas ${manualMode ? "is-pinning" : ""}`}><div ref={elementRef} className="osm-map" aria-label="해외 OpenStreetMap 지도" /><div className="osm-map-note">© OpenStreetMap contributors</div>{manualMode && <div className="pinning-hint">지도에서 기록할 위치를 선택하세요</div>}</div>;
}
