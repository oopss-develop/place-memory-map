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
  await expect(page.getByText("기록할 위치를 지도에서 선택하세요")).toBeVisible();
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

test("multiple visit photos can be browsed", async ({ page }) => {
  const images = ["697855", "d84c32", "315a6b", "8a6f4d"].map((color) => `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='%23${color}'/%3E%3C/svg%3E`);
  await page.addInitScript((photoUrls) => {
    localStorage.setItem("place-memory-visits-v2", JSON.stringify([{
      id: "gallery-visit",
      groupId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      place: { id: "gallery-place", provider: "manual", name: "사진 기록", address: "서울", category: "여행", latitude: 37.51, longitude: 127.01 },
      visitedOn: "2026-09-16",
      title: "네 장의 추억",
      note: "사진 갤러리 테스트",
      rating: 5,
      tags: ["사진"],
      participants: [],
      photoUrls,
      version: 1,
      updatedBy: "test",
    }]));
    localStorage.setItem("place-memory-install-prompt-dismissed-v1", "true");
  }, images);
  await page.goto("/");
  await page.locator('[data-visit-id="gallery-visit"]').click();
  await expect(page.getByText("1 / 4")).toBeVisible();
  await page.getByRole("button", { name: "다음 사진" }).click();
  await expect(page.getByText("2 / 4")).toBeVisible();
  await expect(page.locator(".sheet-photo img")).toHaveAttribute("src", images[1]);
});
