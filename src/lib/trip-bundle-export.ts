import JSZip from "jszip";
import { createTripWorkbook, mapLink, tripExportFilename, type DayMapImage } from "@/lib/trip-export";
import { daySegments } from "@/lib/timetable";
import type { ScheduleItem, Trip } from "@/types/domain";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function tripOfflineHtml(trip: Trip, input: ScheduleItem[], provider: "kakao" | "osm", maps: DayMapImage[]) {
  const items = input.filter((item) => item.tripId === trip.id);
  const days = maps.map(({ date, image, fallback }) => {
    const segments = daySegments(items, date);
    if (!segments.length) return `<section id="day-${date}"><h2>${date}</h2><p>예정된 일정이 없어요.</p></section>`;
    const from = segments.length ? Math.floor(Math.min(...segments.map((s) => s.start)) / 60) * 60 : 480;
    const to = segments.length ? Math.ceil(Math.max(...segments.map((s) => s.end)) / 60) * 60 : 1080;
    const lanes = Math.max(1, ...segments.map((s) => s.lanes));
    const ticks = Array.from({ length: Math.ceil((to - from) / 30) }, (_, i) => from + i * 30);
    const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    // Extra boundaries keep short, overlapping and overnight visits separate and readable.
    const boundaries = [...new Set([...ticks, to, ...segments.flatMap((s) => [s.start, s.end])])].sort((a, b) => a - b);
    const blanks = boundaries.slice(0, -1).flatMap((_, row) => Array.from({ length: lanes }, (_, lane) => `<div style="grid-row:${row + 1};grid-column:${lane + 2};background:white"></div>`)).join("");
    const grid = blanks + boundaries.slice(0, -1).map((minute, i) => `<time style="grid-row:${i + 1};grid-column:1">${clock(minute)}</time>`).join("") + segments.map(({ item, start, end, lane, order }) => `<div class="event" style="grid-row:${boundaries.indexOf(start) + 1}/${boundaries.indexOf(end) + 1};grid-column:${lane + 2}"><b>${order}. ${escapeHtml(item.title)}</b><span>${clock(start)}–${clock(end)}${item.startsAt.slice(0, 10) < date ? " · 전날부터 계속" : ""}</span><span>${escapeHtml(item.place.name)}</span></div>`).join("");
    return `<section id="day-${date}"><h2>${date}</h2><div class="day"><div><div class="timetable" style="grid-template-columns:62px repeat(${lanes},minmax(150px,1fr));grid-template-rows:repeat(${boundaries.length - 1},minmax(64px,auto))">${grid}</div>${!segments.length ? "<p>예정된 일정이 없어요.</p>" : ""}</div><div><img class="map" src="${image.dataUrl}" alt="${date} 번호 핀 지도"><p class="note">${escapeHtml(image.description)}${fallback ? " · 지도 캡처 대신 장소 위치도를 넣었습니다." : ""}</p><ol>${segments.map(({ item, order }) => `<li value="${order}"><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.startsAt.slice(11,16))}–${escapeHtml(item.endsAt.slice(11,16))} · <a href="${escapeHtml(mapLink(item, provider))}">${escapeHtml(item.place.name)}</a></p><p>${escapeHtml(item.place.address)}</p>${item.note ? `<p class="memo">${escapeHtml(item.note)}</p>` : ""}</li>`).join("")}</ol></div></div></section>`;
  }).join("");
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(trip.name)}</title><style>*{box-sizing:border-box}body{margin:0 auto;padding:32px;max-width:1500px;color:#243746;background:#fff;font:15px/1.5 'Malgun Gothic',sans-serif}h1{margin-bottom:8px}nav{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}a{color:#0369a1}section{border-top:1px solid #cbd5e1;margin-top:32px;padding-top:16px}.day{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px}.day>div{min-width:0;overflow:auto}.timetable{display:grid;gap:1px;background:#cbd5e1;border:1px solid #cbd5e1}.timetable time{background:#f1f5f9;padding:8px;font-variant-numeric:tabular-nums}.event{background:#e0f2fe;padding:10px;overflow-wrap:anywhere;z-index:1}.event span{display:block;font-size:13px}.map{width:100%;height:auto}.note{color:#475569;font-size:13px}li{padding:10px 0;border-bottom:1px solid #e2e8f0}li p{margin:4px 0}.memo{white-space:pre-wrap}@media(max-width:800px){body{padding:16px}.day{grid-template-columns:1fr}}@media print{nav{display:none}section{break-before:page}body{padding:0}.day{gap:16px}.event{print-color-adjust:exact}}</style><h1>${escapeHtml(trip.name)}</h1><p>${trip.startDate} – ${trip.endDate} · 현지 시각 (${escapeHtml(trip.timeZone)})</p><p>시간표와 지도는 인터넷 없이 볼 수 있어요. 장소 링크는 인터넷 연결이 필요합니다. 브라우저 인쇄로 PDF도 저장할 수 있어요.</p><nav>${maps.map(({ date }) => `<a href="#day-${date}">${date}</a>`).join("")}</nav>${days}</html>`;
}

export async function createTripBundle(trip: Trip, items: ScheduleItem[], provider: "kakao" | "osm", maps: DayMapImage[]) {
  if (!maps.length) throw new Error("날짜별 지도가 없습니다.");
  const zip = new JSZip();
  const workbook = createTripWorkbook(trip, items, maps[0].date, provider, maps[0].image, maps);
  zip.file(tripExportFilename(trip), await workbook.xlsx.writeBuffer());
  zip.file("일정표.html", tripOfflineHtml(trip, items, provider, maps));
  for (const { date, image } of maps) zip.file(`지도/${date}.png`, image.dataUrl.split(",")[1], { base64: true });
  zip.file("읽어주세요.txt", "압축을 푼 뒤 일정표.html을 열면 시간표와 날짜별 지도·방문 순서를 볼 수 있습니다.\n엑셀: 시간표, 일정 상세, 날짜별 지도 시트\n지도 폴더: 날짜별 PNG 이미지\n지도 배경을 가져올 수 없는 날짜에는 위치도라고 표시됩니다.\n자동차 동선은 다운로드할 때 화면에 표시된 날짜의 경로만 포함됩니다. 다른 날짜는 장소 핀을 표시합니다.\n");
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export async function downloadTripBundle(trip: Trip, items: ScheduleItem[], provider: "kakao" | "osm", maps: DayMapImage[]) {
  const blob = await createTripBundle(trip, items, provider, maps);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = tripExportFilename(trip).replace(/\.xlsx$/, ".zip");
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
