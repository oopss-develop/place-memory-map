import { expect, test } from "@playwright/test";

test("shows an empty map journal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "우리의 발자국" })).toBeVisible();
  await expect(page.getByText("아직 남긴 발자국이 없어요.")).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 820) await page.getByRole("button", { name: "기록 목록 열기" }).click();
});

test("manual pin opens the visit form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "우리의 발자국" })).toBeVisible();
  await page.getByRole("button", { name: "지도에 핀 추가" }).click();
  await page.locator(".map-canvas").click({ position: { x: 220, y: 180 }, force: true });
  await expect(page.getByRole("heading", { name: "이 위치에 이름을 붙여주세요" })).toBeVisible();
});
