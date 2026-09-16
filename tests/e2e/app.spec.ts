import { expect, test } from "@playwright/test";

test("shows an empty map journal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "우리의 발자국" })).toBeVisible();
  await expect(page.getByText("아직 남긴 발자국이 없어요.")).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 820) await page.getByRole("button", { name: "기록 목록 열기" }).click();
});

test("manual pin opens the visit form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "기록" })).toBeVisible();
  await page.getByRole("button", { name: "지도에 핀 추가" }).click();
  await page.locator(".map-canvas").click({ position: { x: 220, y: 180 }, force: true });
  await expect(page.getByRole("heading", { name: "이 위치에 이름을 붙여주세요" })).toBeVisible();
});

test("empty journal guides a first visit from the record list", async ({ page }) => {
  await page.goto("/");
  const firstVisit = page.getByRole("button", { name: "지도에서 첫 장소 추가" });
  if ((page.viewportSize()?.width ?? 1000) <= 820) await page.getByRole("button", { name: "기록 목록 열기" }).click();
  await firstVisit.click();
  await expect(page.getByText("지도에서 방문한 위치를 한 번 눌러주세요.")).toBeVisible();
});

test("group owner can delete an additional map", async ({ page }) => {
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1000) <= 820) await page.getByRole("button", { name: "기록 목록 열기" }).click();
  await page.locator(".group-picker-trigger").click();
  await page.getByRole("button", { name: "함께 보는 지도 추가" }).click();
  await page.getByLabel("지도 이름").fill("삭제할 지도");
  await page.getByRole("button", { name: "지도 만들기" }).click();
  await page.getByRole("button", { name: "그룹 메뉴" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "현재 지도 삭제" }).click();
  await expect(page.getByText("“삭제할 지도” 지도를 삭제했습니다.")).toBeVisible();
});

test("a member cannot delete a map created by someone else", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("place-memory-groups-v1", JSON.stringify([
      { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "나린의 지도", role: "owner", memberCount: 4, ownerId: "access-나" },
    ]));
  });
  await page.goto("/");
  await expect(page.getByText("나린의 지도")).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 820) await page.getByRole("button", { name: "기록 목록 열기" }).click();
  await page.getByRole("button", { name: "그룹 메뉴" }).click();
  await expect(page.getByRole("button", { name: "현재 지도 삭제" })).toHaveCount(0);
  await expect(page.getByText("구성원 4명 · 멤버")).toBeVisible();
});
