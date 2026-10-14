import ExcelJS from "exceljs/dist/exceljs.min.js";
import { daySegments, tripDates } from "@/lib/timetable";
import type { MapPoint, ScheduleItem, Trip } from "@/types/domain";

export interface ExportMapImage { dataUrl: string; width: number; height: number; description: string }
const colors = { ink: "243746", paper: "F1F5F9", sheet: "FFFFFF", rule: "CBD5E1", accent: "0369A1" };
export interface DayMapImage { date: string; image: ExportMapImage; fallback: boolean }

export function tripExportFilename(trip: Trip) {
  const name = trip.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "").slice(0, 80) || "여행";
  return `${name}_${trip.startDate}_${trip.endDate}.xlsx`;
}

export function mapLink(point: MapPoint, provider: "kakao" | "osm") {
  const { name, latitude, longitude } = point.place;
  return provider === "kakao"
    ? `https://map.kakao.com/link/map/${encodeURIComponent(name)},${latitude},${longitude}`
    : `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
}

function setupSheet(sheet: ExcelJS.Worksheet, title: string, subtitle: string, columns: number) {
  sheet.properties.defaultRowHeight = 22;
  sheet.views = [{ state: "frozen", ySplit: 4, showGridLines: false }];
  sheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  sheet.mergeCells(1, 1, 1, Math.max(2, columns));
  sheet.getCell(1, 1).value = title;
  sheet.getCell(1, 1).font = { name: "맑은 고딕", size: 18, bold: true, color: { argb: colors.ink } };
  sheet.getRow(1).height = 34;
  sheet.mergeCells(2, 1, 2, Math.max(2, columns));
  sheet.getCell(2, 1).value = subtitle;
  sheet.getCell(2, 1).font = { name: "맑은 고딕", size: 10, color: { argb: colors.ink } };
  sheet.getCell(2, 1).alignment = { wrapText: true, vertical: "middle" };
  sheet.getRow(2).height = 34;
  sheet.headerFooter.oddFooter = "&L우뚜막&R&P / &N";
}

function header(sheet: ExcelJS.Worksheet, labels: string[]) {
  const row = sheet.getRow(4);
  row.values = labels;
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { name: "맑은 고딕", bold: true, size: 11, color: { argb: colors.sheet } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.ink } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

function bodyRow(row: ExcelJS.Row) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: "맑은 고딕", size: 11, color: { argb: colors.ink } };
    cell.alignment = { vertical: "top", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: row.number % 2 ? colors.sheet : colors.paper } };
    cell.border = { bottom: { style: "hair", color: { argb: colors.rule } } };
  });
}

function timeRange(item: ScheduleItem) {
  const end = item.startsAt.slice(0, 10) === item.endsAt.slice(0, 10) ? item.endsAt.slice(11, 16) : item.endsAt.slice(5, 16).replace("T", " ");
  return `${item.startsAt.slice(11, 16)} – ${end}`;
}

export function createTripWorkbook(trip: Trip, inputItems: ScheduleItem[], date: string, provider: "kakao" | "osm", mapImage: ExportMapImage, dailyMaps?: DayMapImage[]) {
  const items = inputItems.filter((item) => item.tripId === trip.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "우뚜막";
  const subtitle = `${trip.startDate} – ${trip.endDate} · 현지 시각 (${trip.timeZone}) · ${items.length}개 일정`;
  const dates = tripDates(trip);
  const plan = workbook.addWorksheet("여행 계획표");
  const days = dates.map((day) => daySegments(items, day));
  const laneCounts = days.map((segments) => Math.max(1, ...segments.map((s) => s.lanes)));
  const columnCount = 1 + laneCounts.reduce((a, b) => a + b, 0);
  setupSheet(plan, trip.name, subtitle, columnCount);
  plan.columns = [{ width: 11 }, ...laneCounts.flatMap((count) => Array.from({ length: count }, () => ({ width: 32 })))];
  header(plan, ["시간", ...dates.flatMap((day, index) => Array(laneCounts[index]).fill(day))]);
  let firstColumn = 2;
  laneCounts.forEach((count) => {
    if (count > 1) plan.mergeCells(4, firstColumn, 4, firstColumn + count - 1);
    firstColumn += count;
  });
  const allSegments = days.flat();
  const from = allSegments.length ? Math.floor(Math.min(...allSegments.map((s) => s.start)) / 60) * 60 : 480;
  const to = allSegments.length ? Math.min(1440, Math.ceil(Math.max(...allSegments.map((s) => s.end)) / 60) * 60) : 1080;
  const boundaries = new Set<number>([from, to]);
  for (let minute = from; minute < to; minute += 30) boundaries.add(minute);
  allSegments.forEach((segment) => { boundaries.add(segment.start); boundaries.add(segment.end); });
  const ticks = [...boundaries].sort((a, b) => a - b);
  ticks.slice(0, -1).forEach((minute, index) => {
    const row = plan.getRow(index + 5);
    row.values = [minute / 1440, ...Array(columnCount - 1).fill("")];
    bodyRow(row);
    row.getCell(1).numFmt = "hh:mm";
    row.height = Math.max(28, (ticks[index + 1] - minute) * 1.6);
  });
  firstColumn = 2;
  days.forEach((segments, dayIndex) => {
    if (!segments.length) plan.getCell(5, firstColumn).value = "예정된 일정이 없어요.";
    segments.forEach(({ item, start, end, lane, order }) => {
      const top = ticks.indexOf(start) + 5;
      const bottom = ticks.indexOf(end) + 4;
      const col = firstColumn + lane;
      if (bottom > top) plan.mergeCells(top, col, bottom, col);
      const cell = plan.getCell(top, col);
      const continuation = item.startsAt.slice(0, 10) < dates[dayIndex] ? "(전날부터 계속) " : "";
      cell.value = `${order}. ${item.title}\n${continuation}${timeRange(item)}\n${item.place.name}`;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: dayIndex % 2 ? "ECFDF5" : "E0F2FE" } };
      cell.font = { name: "맑은 고딕", size: 11, color: { argb: colors.ink }, bold: true };
      cell.alignment = { wrapText: true, vertical: "top", indent: 1 };
      // Short visits still need room for their title, precise time and place.
      const needed = 22 + 16 * (Math.ceil(item.title.length / 15) + Math.ceil(item.place.name.length / 15) + (continuation ? 2 : 1));
      let available = 0;
      for (let row = top; row <= bottom; row++) available += plan.getRow(row).height ?? 28;
      if (available < needed) plan.getRow(top).height = (plan.getRow(top).height ?? 28) + needed - available;
    });
    firstColumn += laneCounts[dayIndex];
  });
  plan.views = [{ state: "frozen", ySplit: 4, xSplit: 1, showGridLines: false }];
  plan.pageSetup.printTitlesRow = "1:4";
  plan.pageSetup.printTitlesColumn = "A:A";

  const detail = workbook.addWorksheet("일정 상세");
  setupSheet(detail, `${trip.name} · 일정 상세`, subtitle, 9);
  detail.columns = [8, 14, 21, 21, 28, 26, 38, 55, 18].map((width) => ({ width }));
  header(detail, ["순서", "날짜", "시작 (현지 시각)", "종료 (현지 시각)", "일정", "장소", "주소", "메모", "지도"]);
  items.forEach((item, index) => {
    const row = detail.addRow([index + 1, item.startsAt.slice(0, 10), item.startsAt.slice(0, 16).replace("T", " "), item.endsAt.slice(0, 16).replace("T", " "), item.title, item.place.name, item.place.address, item.note, { text: "지도 열기", hyperlink: mapLink({ id: item.id, place: item.place, markerStyle: item.markerStyle }, provider) }]);
    bodyRow(row);
    row.height = Math.min(240, Math.max(48, Math.ceil(item.note.length / 45) * 16, item.note.split("\n").length * 16));
    row.getCell(9).font = { name: "맑은 고딕", size: 11, underline: true, color: { argb: colors.accent } };
  });
  if (items.length) detail.autoFilter = { from: "A4", to: `I${items.length + 4}` };

  for (const entry of dailyMaps ?? [{ date, image: mapImage, fallback: false }]) {
  const mapImage = entry.image;
  const date = entry.date;
  const map = workbook.addWorksheet(dailyMaps ? `지도 ${date.slice(5)}` : "지도");
  setupSheet(map, `${trip.name} · ${date} 지도`, mapImage.description, 6);
  map.columns = [9, 22, 32, 42, 16, 16].map((width) => ({ width }));
  const imageWidth = Math.min(960, mapImage.width);
  const imageHeight = imageWidth * mapImage.height / mapImage.width;
  const imageId = workbook.addImage({ base64: mapImage.dataUrl, extension: "png" });
  map.addImage(imageId, { tl: { col: 0, row: 3 }, ext: { width: imageWidth, height: imageHeight }, editAs: "oneCell" });
  const tableRow = 5 + Math.ceil(imageHeight / (22 * 96 / 72));
  map.getRow(tableRow).values = ["핀 번호", "시간", "장소", "주소", "위도", "경도"];
  bodyRow(map.getRow(tableRow));
  daySegments(items, date).forEach(({ item, order }) => {
    const row = map.addRow([order, timeRange(item), { text: item.place.name, hyperlink: mapLink({ id: item.id, place: item.place, markerStyle: item.markerStyle }, provider) }, item.place.address, item.place.latitude, item.place.longitude]);
    bodyRow(row);
    row.height = 40;
    row.getCell(3).font = { name: "맑은 고딕", size: 11, underline: true, color: { argb: colors.accent } };
  });
  map.views = [{ showGridLines: false }];
  }
  return workbook;
}

export async function downloadTripExcel(trip: Trip, items: ScheduleItem[], date: string, provider: "kakao" | "osm", mapImage: ExportMapImage) {
  const workbook = createTripWorkbook(trip, items, date, provider, mapImage);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = tripExportFilename(trip);
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
