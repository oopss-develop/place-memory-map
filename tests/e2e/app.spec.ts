import { expect, test } from "@playwright/test";

test("shows the map journal and opens a visit", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "우리의 발자국" })).toBeVisible();
  await page.getByRole("button", { name: "상세 닫기" }).click();
  await expect(page.locator(".place-sheet")).toBeHidden();
  if ((page.viewportSize()?.width ?? 1000) <= 820) await page.getByRole("button", { name: "기록 목록 열기" }).click();
  await page.locator(".date-group-toggle").nth(1).click();
  await expect(page.locator(".date-group").nth(1)).toHaveClass(/active/);
  await page.locator(".date-group.active .record-item").first().click();
  await expect(page.getByRole("heading", { name: "서울숲 유리온실" })).toBeVisible();
});

test("manual pin opens the visit form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "우리의 발자국" })).toBeVisible();
  await page.getByRole("button", { name: "상세 닫기" }).click();
  await expect(page.locator(".place-sheet")).toBeHidden();
  await page.getByRole("button", { name: "지도에 핀 추가" }).click();
  await page.locator(".map-canvas").click({ position: { x: 220, y: 180 }, force: true });
  await expect(page.getByRole("heading", { name: "이 위치에 이름을 붙여주세요" })).toBeVisible();
});
