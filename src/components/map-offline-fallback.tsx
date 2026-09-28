"use client";
import type { MapPoint } from "@/types/domain";

export function MapOfflineFallback<T extends MapPoint>({ visits, manualMode, onSelect, onManualPoint }: { visits: T[]; manualMode: boolean; onSelect: (point: T) => void; onManualPoint: (latitude: number, longitude: number) => void }) {
  return <div className="map-offline-fallback" role="region" aria-label="지도 대체 보기"><strong>지도를 불러오지 못했어요.</strong><p>아래 장소를 선택해 일정을 확인할 수 있어요.</p>{visits.map((point) => <button key={point.id} onClick={() => onSelect(point)}>{point.pinLabel} · {point.place.name}</button>)}{manualMode && <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onManualPoint(Number(data.get("latitude")), Number(data.get("longitude"))); }}><p>위도·경도를 입력해서 장소를 추가할 수 있어요.</p><label>위도<input name="latitude" type="number" min={-90} max={90} step="any" required /></label><label>경도<input name="longitude" type="number" min={-180} max={180} step="any" required /></label><button type="submit">이 좌표 선택</button></form>}</div>;
}
