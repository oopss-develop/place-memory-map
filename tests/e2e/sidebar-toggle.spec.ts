import { expect, test } from "@playwright/test";

for (const width of [821, 1280, 1440]) test(`desktop sidebar hides, restores focus and persists at ${width}px`, async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  const sidebar = page.locator("#journal-sidebar");
  await expect(sidebar).toBeVisible();
  const before = await page.locator(".map-stage").evaluate(el => el.clientWidth);
  await page.getByRole("button", { name: "왼쪽 메뉴 숨기기", exact: true }).click();
  await expect(sidebar).toBeHidden();
  const open = page.getByRole("button", { name: "왼쪽 메뉴 펼치기", exact: true });
  await expect(open).toBeFocused();
  expect(await page.locator(".map-stage").evaluate(el => el.clientWidth)).toBeGreaterThan(before);
  await page.screenshot({ path: test.info().outputPath(`sidebar-hidden-${width}.png`) });
  await page.reload(); await expect(sidebar).toBeHidden(); await expect(open).toBeVisible();
  await open.click(); await expect(sidebar).toBeVisible();
  await expect(page.getByRole("button", { name: "왼쪽 메뉴 숨기기", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "여행 계획", exact: true }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "왼쪽 메뉴 숨기기", exact: true }).click();
  await expect(page.locator("#planner-navigation")).toBeHidden();
  await expect(open).toBeVisible(); await open.click();
  await expect(page.locator("#planner-navigation")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("desktop preference leaves mobile navigation available", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile");
  await page.addInitScript(() => localStorage.setItem("demo-viewer:desktop-sidebar-collapsed", "true"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "왼쪽 메뉴 펼치기", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "기록 목록 열기", exact: true }).click();
  await expect(page.locator("#journal-sidebar")).toBeVisible();
  await expect(page.getByRole("button", { name: "왼쪽 메뉴 숨기기", exact: true })).toBeHidden();
});
