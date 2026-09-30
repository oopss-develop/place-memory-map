import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { createTripWorkbook, tripExportFilename } from "@/lib/trip-export";
import type { ScheduleItem, Trip } from "@/types/domain";

const trip: Trip = { id: "trip", groupId: "group", name: "서울 여행", startDate: "2026-10-03", endDate: "2026-10-05", timeZone: "America/New_York", version: 1 };
const image = { dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=", width: 960, height: 600, description: "장소 위치도 · 지도 배경 없음" };
const item: ScheduleItem = { id: "item", tripId: trip.id, groupId: trip.groupId, startsAt: "2026-10-03T23:00", endsAt: "2026-10-04T01:00", title: "=일정 제목", note: "첫째 줄\n둘째 줄", place: { id: "place", provider: "manual", name: "북촌 산책", address: "서울 종로", category: "여행", latitude: 37.58, longitude: 126.98 }, markerStyle: "black-9", version: 1 };

describe("trip Excel export", () => {
  it("round-trips the whole trip, overnight continuation, literal text, local clocks, links and embedded map", async () => {
    const source = createTripWorkbook(trip, [item, { ...item, id: "other", tripId: "different-trip" }], "2026-10-04", "kakao", image);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await source.xlsx.writeBuffer());
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["여행 계획표", "일정 상세", "지도"]);
    const plan = workbook.getWorksheet("여행 계획표")!;
    expect(plan.getCell("A5").value).toContain("23:00 – 10-04 01:00");
    expect(plan.getCell("B5").value).toContain("전날부터 계속");
    expect(plan.getCell("C5").value).toBe("예정된 일정이 없어요.");
    const detail = workbook.getWorksheet("일정 상세")!;
    expect(detail.rowCount).toBe(5);
    expect(detail.getCell("C5").value).toBe("2026-10-03 23:00");
    expect(detail.getCell("D5").value).toBe("2026-10-04 01:00");
    expect(detail.getCell("E5").value).toBe("=일정 제목");
    expect(detail.getCell("H5").value).toBe(item.note);
    expect(detail.getCell("I5").value).toMatchObject({ hyperlink: expect.stringContaining("https://map.kakao.com/link/map/") });
    const map = workbook.getWorksheet("지도")!;
    expect(map.getCell("A1").value).toContain("2026-10-04");
    expect(map.getImages()).toHaveLength(1);
    expect(map.getRow(map.rowCount).getCell(3).value).toMatchObject({ text: "북촌 산책" });
  });

  it("exports an empty trip and uses overseas map links", () => {
    const empty = createTripWorkbook(trip, [], "2026-10-05", "osm", image);
    expect(empty.getWorksheet("여행 계획표")!.getCell("A5").value).toBe("예정된 일정이 없어요.");
    expect(empty.getWorksheet("지도")!.getImages()).toHaveLength(1);
    const overseas = createTripWorkbook(trip, [item], "2026-10-03", "osm", image);
    expect(overseas.getWorksheet("일정 상세")!.getCell("I5").value).toMatchObject({ hyperlink: expect.stringContaining("https://www.openstreetmap.org/") });
  });

  it("makes safe download filenames", () => {
    expect(tripExportFilename({ ...trip, name: '여행/계획:*?"<>|\\' })).toBe("여행_계획_________2026-10-03_2026-10-05.xlsx");
    expect(tripExportFilename({ ...trip, name: "..." })).toBe("여행_2026-10-03_2026-10-05.xlsx");
  });
});
