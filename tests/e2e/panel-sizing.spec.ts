import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const groupId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    localStorage.setItem("place-memory-install-prompt-dismissed-v1", "true");
    if (!localStorage.getItem("place-memory-trips-v1:" + groupId)) localStorage.setItem("place-memory-trips-v1:" + groupId, JSON.stringify({ trips: [{ id: "trip", groupId, name: "크기 조절 여행", startDate: "2026-10-01", endDate: "2026-10-03", timeZone: "Asia/Seoul", version: 1 }], items: [] }));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "여행 계획", exact: true }).filter({ visible: true }).click();
});

test("resizes travel panels, remembers sizes and resets them", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "desktop split layout");
  await page.setViewportSize({ width: 1440, height: 900 });
  const widthHandle = page.getByRole("separator", { name: "시간표와 지도 너비 조절" });
  const heightHandle = page.getByRole("separator", { name: "지도와 일정 목록 높이 조절" });
  await expect(widthHandle).toBeVisible();
  const before = (await page.locator(".planner-map-canvas").boundingBox())!;
  const handle = (await widthHandle.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x - 160, handle.y + handle.height / 2, { steps: 12 });
  await page.mouse.up();
  expect((await page.locator(".planner-map-canvas").boundingBox())!.width).toBeGreaterThan(before.width + 100);
  const saved = await widthHandle.getAttribute("aria-valuenow");
  await heightHandle.focus(); await page.keyboard.press("Shift+ArrowDown");
  expect((await page.locator(".planner-map-canvas").boundingBox())!.height).toBeGreaterThan(before.height);
  await page.reload();
  await page.getByRole("button", { name: "여행 계획", exact: true }).filter({ visible: true }).click();
  await expect(widthHandle).toHaveAttribute("aria-valuenow", saved!);
  await expect(heightHandle).toHaveAttribute("aria-valuenow", "72");
  await page.screenshot({ path: test.info().outputPath("resized-panels.png") });
  await widthHandle.dblclick(); await heightHandle.focus(); await page.keyboard.press("Enter");
  await expect(widthHandle).toHaveAttribute("aria-valuenow", "52");
  await expect(heightHandle).toHaveAttribute("aria-valuenow", "62");
  for (const width of [821, 1024, 1280]) {
    await page.setViewportSize({ width, height: 720 });
    await widthHandle.focus(); await page.keyboard.press("Home");
    expect((await page.locator(".planner-time-panel").boundingBox())!.width).toBeGreaterThanOrEqual(239);
    await page.keyboard.press("End");
    expect((await page.locator(".planner-map-panel").boundingBox())!.width).toBeGreaterThanOrEqual(279);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("keeps mobile panels in tabs without resize handles", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "mobile tab layout");
  await expect(page.getByRole("separator")).toHaveCount(0);
  await page.getByRole("radio", { name: "지도", exact: true }).click();
  await expect(page.locator(".planner-map-canvas")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
