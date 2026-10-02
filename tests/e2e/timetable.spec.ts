import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const groupId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const visit = { id: "60000000-0000-4000-8000-000000000001", groupId, place: { id: "30000000-0000-4000-8000-000000000001", provider: "manual", name: "북촌 산책", address: "서울 종로", category: "여행", latitude: 37.58, longitude: 126.98 }, visitedOn: "2026-09-01", isPlanned: true, title: "다시 가고 싶은 곳", note: "원본 메모", rating: 4, tags: [], participants: [], photoUrls: [], markerStyle: "black-9", version: 1, updatedBy: "test" };
async function openPlanner(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "여행 계획", exact: true }).filter({ visible: true }).click();
}
async function createTrip(page: Page) {
  await page.getByRole("button", { name: "첫 여행 만들기" }).click();
  await page.getByLabel("여행 이름", { exact: true }).fill("서울 2박 3일");
  await page.getByLabel("시작일", { exact: true }).fill("2026-10-03");
  await page.getByLabel("종료일", { exact: true }).fill("2026-10-05");
  await page.getByRole("button", { name: "여행 저장", exact: true }).click();
  await expect(page.getByLabel("계획 날짜")).toHaveValue("2026-10-03");
  if ((page.viewportSize()?.width ?? 1000)<=820) await page.getByRole("radio",{name:"시간표",exact:true}).click();
}
async function addExisting(page: Page) {
  await page.getByRole("button", { name: "일정 추가", exact: true }).click();
  await page.getByRole("radio", { name: "기존 기록", exact: true }).click();
  await page.getByLabel("방문 예정만").check();
  await page.getByRole("button", { name: /북촌 산책.*다시 가고 싶은 곳/ }).click();
  await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(page.locator(".schedule-block-body").first()).toContainText("북촌 산책");
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript((record) => {
    localStorage.setItem("place-memory-visits-v2", JSON.stringify([record]));
    localStorage.setItem("place-memory-install-prompt-dismissed-v1", "true");
  }, visit);
});

test("downloads the whole travel plan with an embedded map and place links", async ({ page }, testInfo) => {
  await openPlanner(page); await createTrip(page); await addExisting(page);
  const downloadEvent = page.waitForEvent("download");
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "여행 탐색 열기" }).click();
  await page.getByRole("button", { name: "엑셀 다운로드", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("서울 2박 3일_2026-10-03_2026-10-05.xlsx");
  const path = testInfo.outputPath("travel-plan.xlsx");
  await download.saveAs(path);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["여행 계획표", "일정 상세", "지도"]);
  expect(workbook.getWorksheet("여행 계획표")!.getCell("C4").value).toBe("2026-10-05");
  expect(workbook.getWorksheet("일정 상세")!.getCell("F5").value).toBe("북촌 산책");
  expect(workbook.getWorksheet("지도")!.getImages()).toHaveLength(1);
  await expect(page.getByRole("status")).toContainText("장소 위치도와 지도 링크");
  await page.screenshot({ path: testInfo.outputPath("excel-export.png") });
});

test("trip, saved place, edit, map and persistence preserve the original memory", async ({ page }, testInfo) => {
  await openPlanner(page); await createTrip(page); await addExisting(page);
  await page.locator(".schedule-block-body").first().click();
  await page.getByRole("button", { name: "일정 수정", exact: true }).click();
  await page.getByLabel("일정 시작", { exact: true }).fill("2026-10-03T10:00");
  await page.getByLabel("일정 종료", { exact: true }).fill("2026-10-03T11:30");
  await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(page.locator(".schedule-block-body").first()).toContainText("10:00–11:30");
  const mobile = testInfo.project.name === "mobile";
  if (mobile) await page.getByRole("radio", { name: "지도", exact: true }).click();
  await page.locator(".planner-map-canvas [data-visit-id]").click();
  await page.locator(".planner-map-agenda").getByRole("button", { name: /북촌 산책/ }).click();
  await expect(page.locator(".schedule-block.selected")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("timetable.png") });
  await page.reload(); await page.getByRole("button", { name: "여행 계획", exact: true }).filter({ visible: true }).click();
  await expect(page.locator(".schedule-block-body").first()).toContainText("10:00–11:30");
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem("place-memory-visits-v2")!)[0]);
  expect(original.visitedOn).toBe("2026-09-01"); expect(original.note).toBe("원본 메모");
});

test("search, overnight entries, overlapping places and failure fallback", async ({ page }, testInfo) => {
  await page.route("**/api/places/search?**", (route) => route.fulfill({ json: { results: [{ id: "search-id", placeName: "서울 야경", roadAddressName: "서울", addressName: "서울", categoryName: "전망", latitude: 37.57, longitude: 126.99 }] } }));
  await openPlanner(page); await createTrip(page);
  await page.getByRole("button", { name: "일정 추가", exact: true }).click();
  await page.getByLabel("일정 시작").fill("2026-10-03T23:00"); await page.getByLabel("일정 종료").fill("2026-10-04T01:00");
  await page.getByLabel("일정 장소 검색").fill("서울 야경"); await page.getByRole("button", { name: "검색", exact: true }).click();
  await page.getByRole("button", { name: "서울 야경 서울", exact: true }).click();
  await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  await page.getByLabel("계획 날짜").fill("2026-10-04");
  await expect(page.locator('.timetable-day.current .schedule-block')).toHaveCount(1);
  await page.route("**/api/places/search?**", (route) => route.fulfill({ status: 429, json: { error: "검색 한도 초과" } }));
  await page.getByRole("button", { name: "일정 추가", exact: true }).click();
  await page.getByLabel("일정 장소 검색").fill("없는 장소"); await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "검색 한도 초과" })).toBeVisible();
  await page.getByRole("button", { name: "지도에서 직접 선택", exact: true }).click();
  await page.locator(".planner-map-canvas .map-canvas").click({ position: { x: 120, y: 100 }, force: true });
  await expect(page.getByRole("dialog", { name: "일정 편집" })).toBeVisible();
  await expect(page.getByLabel("일정 시작")).toHaveValue("2026-10-04T09:00");
  await page.getByLabel("장소 이름", { exact: true }).fill("직접 고른 장소");
  await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  if (testInfo.project.name === "mobile") await page.getByRole("radio", { name: "시간표", exact: true }).click();
  await expect(page.locator('.timetable-day.current .schedule-block')).toHaveCount(2);
});

test("ordered trip route is saved and restored without another route request", async ({ page }, testInfo) => {
  await page.route("**/api/places/search?**", (route) => route.fulfill({ json: { results: [{ id: "route-place", placeName: "성수 목적지", roadAddressName: "서울 성동구", addressName: "서울", categoryName: "장소", latitude: 37.545, longitude: 127.055 }] } }));
  await openPlanner(page); await createTrip(page); await addExisting(page);
  await page.getByRole("button", { name: "일정 추가", exact: true }).click();
  await page.getByLabel("일정 장소 검색").fill("성수 목적지"); await page.getByRole("button", { name: "검색", exact: true }).click();
  await page.getByRole("button", { name: "성수 목적지 서울 성동구", exact: true }).click();
  await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  if (testInfo.project.name === "mobile") await page.getByRole("radio", { name: "지도", exact: true }).click();
  await expect(page.locator(".trip-number-pin")).toHaveCount(2);
  await expect(page.locator('.trip-number-pin[data-pin-number="1"]')).toBeVisible();
  await expect(page.locator('.trip-number-pin[data-pin-number="2"]')).toBeVisible();
  await page.locator('.trip-number-pin[data-pin-number="1"]').click();
  await expect(page.locator('.trip-number-pin[data-pin-number="1"] img')).toHaveCSS("animation-name", "map-pin-bounce");
  await page.getByRole("button", { name: "동선 확인", exact: true }).click();
  await expect(page.locator(".trip-route-overlay")).toBeVisible();
  await expect(page.locator(".planner-route-status")).toContainText("연결선");
  await page.reload(); await openPlanner(page);
  if (testInfo.project.name === "mobile") await page.getByRole("radio", { name: "지도", exact: true }).click();
  await expect(page.locator(".trip-route-overlay")).toBeVisible();
  await expect(page.getByRole("button", { name: "동선 숨기기", exact: true })).toBeVisible();
});

test("mouse drag creates, moves and resizes while rejecting out-of-range edits", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "mouse interaction covered on desktop");
  await openPlanner(page); await createTrip(page);
  const column = page.locator('[data-column-day="2026-10-03"]');
  const rect = (await column.boundingBox())!;
  const x = rect.x + 80; const y = rect.y + 9 * 60 * 1.2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + 72, { steps: 8 }); await page.mouse.up();
  await expect(page.getByLabel("일정 시작")).toHaveValue("2026-10-03T09:00");
  await expect(page.getByLabel("일정 종료")).toHaveValue("2026-10-03T10:00");
  await page.getByRole("radio", { name: "기존 기록", exact: true }).click(); await page.getByRole("button", { name: /북촌 산책.*다시 가고 싶은 곳/ }).click(); await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  const body = page.locator(".schedule-block-body").first();
  const block = (await body.boundingBox())!;
  await page.mouse.move(block.x + 50, block.y + 24); await page.mouse.down(); await page.mouse.move(block.x + 50, block.y + 60, { steps: 6 }); await page.mouse.up();
  await expect(body).toContainText("09:30–10:30");
  const handle = (await page.locator(".schedule-resize.end").first().boundingBox())!;
  await page.mouse.move(handle.x + 40, handle.y + 3); await page.mouse.down(); await page.mouse.move(handle.x + 40, handle.y + 39, { steps: 6 }); await page.mouse.up();
  await expect(body).toContainText("09:30–11:00");
  await body.click(); await page.getByRole("button", { name: "일정 수정", exact: true }).click(); await page.getByLabel("일정 종료").fill("2026-10-06T12:00"); await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "여행 기간 안" })).toBeVisible();
  await page.getByRole("button", { name: "취소", exact: true }).click(); await expect(body).toContainText("09:30–11:00");
});

test("short adjacent schedules remain selectable and same-location visits share one pin", async ({ page }, testInfo) => {
  await openPlanner(page); await createTrip(page);
  for (const [start, end] of [["09:00", "09:15"], ["09:15", "09:30"]]) {
    await page.getByRole("button", { name: "일정 추가", exact: true }).click();
    await page.getByLabel("일정 시작").fill(`2026-10-03T${start}`); await page.getByLabel("일정 종료").fill(`2026-10-03T${end}`);
    await page.getByRole("radio", { name: "기존 기록", exact: true }).click(); await page.getByRole("button", { name: /북촌 산책.*다시 가고 싶은 곳/ }).click(); await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  }
  const compact = page.locator(".schedule-block.compact");
  await expect(compact).toHaveCount(2);
  const content = await compact.first().locator("strong").evaluate((element) => { const box = element.getBoundingClientRect(); const parent = element.closest(".schedule-block")!.getBoundingClientRect(); return { height: box.height, visible: box.top >= parent.top && box.bottom <= parent.bottom }; });
  expect(content.height).toBeGreaterThanOrEqual(16); expect(content.visible).toBe(true);
  await compact.last().locator(".schedule-block-body").press("Enter");
  await expect(page.getByRole("button", { name: "일정 수정", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("short-schedules.png") });
  if (testInfo.project.name === "mobile") await page.getByRole("radio", { name: "지도", exact: true }).click();
  await expect(page.locator(".planner-map-canvas [data-visit-id]")).toHaveCount(1);
  await page.locator(".planner-map-canvas [data-visit-id]").click();
  await expect(page.locator(".planner-map-agenda").getByRole("button", { name: /북촌 산책/ })).toHaveCount(2);
});

test("mobile long press creates time range while normal touch scroll stays available", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "touch interaction on mobile");
  await openPlanner(page); await createTrip(page);
  const session = await page.context().newCDPSession(page);
  await page.locator(".timetable-scroll").evaluate(element => { element.scrollTop=9*60*1.2-100; });
  const column = (await page.locator('.timetable-day.current .timetable-column').boundingBox())!;
  const x = column.x + 100; const y = column.y + 9 * 60 * 1.2;
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  // The deliberate wait exercises the 400ms long-press threshold.
  await page.waitForTimeout(450);
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + 72 }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.getByRole("dialog", { name: "일정 편집" })).toBeVisible();
  await expect(page.getByLabel("일정 시작")).toHaveValue("2026-10-03T09:00");
  await expect(page.getByLabel("일정 종료")).toHaveValue("2026-10-03T10:00");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  const scroller = page.locator(".timetable-scroll"); const before = await scroller.evaluate((element) => element.scrollTop);
  const viewport = (await scroller.boundingBox())!;
  const scrollY = viewport.y + viewport.height / 2;
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: scrollY + 45 }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: scrollY - 45 }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(before);
  await expect(page.getByRole("dialog", { name: "일정 편집" })).toHaveCount(0);
});
