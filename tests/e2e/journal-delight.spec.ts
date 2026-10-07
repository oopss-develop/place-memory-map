import { expect, test } from "@playwright/test";

const groupId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const place = { id: "place", provider: "manual", name: "서울 숲", address: "서울", category: "산책", latitude: 37.54, longitude: 127.04 };
const record = { id: "memory-one", groupId, place, visitedOn: "2026-10-01", isPlanned: false, title: "첫 추억", note: "함께 걸었어요", rating: 5, tags: ["산책", "데이트"], participants: [], photoUrls: [], markerStyle: "black-9", version: 1, updatedBy: "나" };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ record }) => {
    localStorage.setItem("place-memory-visits-v2", JSON.stringify([record, { ...record, id: "memory-two", title: "두 번째 추억" }, { ...record, id: "planned", isPlanned: true }]));
    localStorage.setItem("place-memory-theme-v1", "dark");
    localStorage.setItem("place-memory-font-v1", "nanum-square");
    localStorage.setItem("place-memory-install-prompt-dismissed-v1", "true");
  }, { record });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const width of [320, 360, 390, 821, 1280, 1440]) test(`record filters and editor fit at ${width}px`, async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "explicit viewport coverage");
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  if (width <= 820) await page.getByRole("button", { name: "기록 목록 열기" }).click();
  await expect(page.locator(".date-group-toggle")).toContainText("방문 3회");
  await page.getByRole("radio", { name: "저장된 기록", exact: true }).click();
  await page.getByRole("button", { name: "상세 필터", exact: true }).click();
  await page.locator('.record-filter-panel input[type="checkbox"]').nth(0).check();
  await page.locator('.record-filter-panel input[type="checkbox"]').nth(1).check();
  await expect(page.getByText("조건 적용 중", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "전체", exact: true })).toHaveAttribute("data-state", "off");
  await page.getByRole("button", { name: "상세 필터", exact: true }).click();
  await expect(page.getByRole("button", { name: "추억 한 장", exact: true })).toHaveCount(0);
  await page.locator(".date-group-toggle").click();
  await page.locator(".record-item").first().click();
  await expect(page.locator(".place-sheet")).toBeVisible();
  await page.getByRole("button", { name: "수정", exact: true }).click();
  const note = page.getByLabel("무엇을 했나요?", { exact: true });
  await note.fill("한글 조합 입력을 유지해요");
  await expect(page.getByRole("button", { name: "다른 질문", exact: true })).toHaveCount(0);
  await expect(note).toHaveValue("한글 조합 입력을 유지해요");
  expect(await page.locator(".visit-dialog").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("record-editor.png") });
  await page.getByRole("button", { name: "취소", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("uses travel presets without changing map height and resets both sizes", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "desktop layout controls");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(groupId => localStorage.setItem("place-memory-trips-v1:" + groupId, JSON.stringify({ trips: [{ id: "trip", groupId, name: "여행", startDate: "2026-10-01", endDate: "2026-10-03", timeZone: "Asia/Seoul", version: 1 }], items: [] })), groupId);
  await page.goto("/");
  await page.getByRole("button", { name: "여행 계획", exact: true }).filter({ visible: true }).click();
  const height = page.getByRole("separator", { name: "지도와 일정 목록 높이 조절" });
  await height.focus(); await page.keyboard.press("Shift+ArrowDown");
  await page.getByRole("button", { name: "화면 배치", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "지도 넓게", exact: true }).click();
  await expect(page.getByRole("separator", { name: "시간표와 지도 너비 조절" })).toHaveAttribute("aria-valuenow", "35");
  await expect(height).toHaveAttribute("aria-valuenow", "72");
  await page.getByRole("button", { name: "크기 초기화", exact: true }).click();
  await expect(height).toHaveAttribute("aria-valuenow", "62");
  await expect(page.getByRole("separator", { name: "시간표와 지도 너비 조절" })).toHaveAttribute("aria-valuenow", "52");
});
