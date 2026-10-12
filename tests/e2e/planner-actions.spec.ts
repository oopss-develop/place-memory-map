import { expect, test } from "@playwright/test";

const groupId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(groupId => {
    localStorage.setItem("place-memory-install-prompt-dismissed-v1", "true");
    localStorage.setItem("place-memory-trips-v1:" + groupId, JSON.stringify({
      trips: [{ id: "trip", groupId, name: "제주 2박 3일", startDate: "2026-10-01", endDate: "2026-10-03", timeZone: "Asia/Seoul", version: 1 }],
      items: [{ id: "item", groupId, tripId: "trip", startsAt: "2026-10-01T09:00", endsAt: "2026-10-01T10:00", title: "아침 산책", note: "편한 신발을 준비하세요", version: 1, markerStyle: "black-9", place: { id: "place", provider: "manual", name: "제주 바닷길", address: "제주시", category: "산책", latitude: 33.5, longitude: 126.5 } }],
    }));
  }, groupId);
  await page.goto("/");
  await page.getByRole("button", { name: "여행 계획", exact: true }).filter({ visible: true }).click();
});

test("keeps actions with their targets and selection height stable", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "desktop workspace");
  await page.setViewportSize({ width: 1440, height: 900 });
  const management = page.getByRole("group", { name: "여행 관리", exact: true });
  await expect(management.getByRole("button", { name: "여행 설정", exact: true })).toBeVisible();
  await expect(management.getByRole("button", { name: "제주 2박 3일 엑셀 다운로드", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "시간표 편집", exact: true }).getByRole("button", { name: "일정 추가", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "지도와 동선", exact: true }).getByRole("button", { name: "동선 확인", exact: true })).toBeDisabled();
  const selection = page.getByRole("region", { name: "선택 일정", exact: true });
  const emptyHeight = (await selection.boundingBox())!.height;
  await page.locator(".schedule-block-body").first().click();
  await expect(selection).toContainText("아침 산책");
  expect((await selection.boundingBox())!.height).toBe(emptyHeight);
  await page.screenshot({ path: info.outputPath("planner-desktop.png") });
  await selection.getByRole("button", { name: "일정 선택 닫기", exact: true }).click();
  await expect(selection).toContainText("일정을 선택하면 여기에서 수정할 수 있어요");
  expect((await selection.boundingBox())!.height).toBe(emptyHeight);
  const settings = management.getByRole("button", { name: "보기 설정", exact: true });
  await settings.focus(); await page.keyboard.press("Enter");
  const popover = page.getByRole("dialog", { name: "보기 설정", exact: true });
  await expect(popover.getByRole("button", { name: "화면 배치", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden(); await expect(settings).toBeFocused();
  await management.getByRole("button", { name: "여행 설정", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "여행 설정", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.locator(".planner-picker-heading").getByRole("button", { name: "새 여행", exact: true }).click();
  await expect(page.getByLabel("여행 이름", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  for (const width of [821, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(management.getByRole("button", { name: "여행 설정", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: info.outputPath("planner-narrow.png") });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await page.locator(".schedule-block-body").first().click();
  await expect(selection.getByRole("button", { name: "일정 수정", exact: true })).toBeVisible();
  expect(await selection.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
  expect(await page.locator(".planner-sidebar-footer").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("planner-text-zoom.png") });
});

test("keeps mobile creation and travel management accessible", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "mobile workflow");
  await expect(page.getByRole("button", { name: "일정 추가", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "제주 2박 3일 엑셀 다운로드", exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "지도", exact: true }).click();
  await expect(page.getByRole("heading", { name: "지도 · 동선", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "동선 확인", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("planner-mobile-map.png") });
});
