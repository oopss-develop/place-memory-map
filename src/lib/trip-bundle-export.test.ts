import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { createTripBundle, tripOfflineHtml } from "./trip-bundle-export";
import { createTripWorkbook } from "./trip-export";
import { exportDayPins } from "./trip-day-capture";
import type { ScheduleItem, Trip } from "@/types/domain";

const trip: Trip = { id: "t", groupId: "g", name: "제주 <여행>", startDate: "2026-10-22", endDate: "2026-10-23", timeZone: "Asia/Seoul", version: 1 };
const item: ScheduleItem = { id: "a", tripId: "t", groupId: "g", title: "<script>alert(1)</script>", note: "첫 줄\n둘째 줄", startsAt: "2026-10-22T09:15", endsAt: "2026-10-22T10:30", place: { id: "p", provider: "manual", name: "카페", address: "제주", category: "", latitude: 33.4, longitude: 126.3 }, markerStyle: "black-9", version: 1 };
const image = { dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=", width: 960, height: 600, description: "장소 위치도 · 지도 배경 없음" };
const maps = [{ date: trip.startDate, image, fallback: true }, { date: trip.endDate, image, fallback: false }];

describe("whole-trip bundle", () => {
  it("packages each day, embedded map sheets and a self-contained safe HTML", async () => {
    const blob = await createTripBundle(trip, [item], "kakao", maps);
    const data = await new Promise<ArrayBuffer>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.readAsArrayBuffer(blob); });
    const zip = await JSZip.loadAsync(data);
    expect(zip.file("지도/2026-10-22.png")).toBeTruthy();
    expect(zip.file("지도/2026-10-23.png")).toBeTruthy();
    const html = await zip.file("일정표.html")!.async("string");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain(image.dataUrl);
    expect(html).toContain("예정된 일정이 없어요.");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await zip.file("제주 _여행__2026-10-22_2026-10-23.xlsx")!.async("uint8array") as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    expect(workbook.worksheets.map((s) => s.name)).toEqual(["여행 계획표", "일정 상세", "지도 10-22", "지도 10-23"]);
    expect(workbook.getWorksheet("지도 10-22")!.getImages()).toHaveLength(1);
  });

  it("preserves overlap lanes, precise times and shared pin numbering", () => {
    const other = { ...item, id: "b", title: "두 번째", startsAt: "2026-10-22T10:00", endsAt: "2026-10-22T11:00" };
    const plan = createTripWorkbook(trip, [item, other], trip.startDate, "kakao", image, maps).getWorksheet("여행 계획표")!;
    expect(plan.getColumn(2).values.join(" ")).toContain("09:15");
    expect(plan.getColumn(3).values.join(" ")).toContain("두 번째");
    expect(exportDayPins([item, other], trip.startDate)[0].pinNumber).toBe("1,2");
    expect(tripOfflineHtml(trip, [item], "osm", maps)).toContain("openstreetmap.org");
  });
});
