import { expect, test } from "@playwright/test";

const groupId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const visitId = "11111111-1111-4111-8111-111111111111";
test("shows the comment section in overview and map details on phone and desktop", async ({ page }) => {
  await page.addInitScript(({ groupId, visitId }) => {
    localStorage.setItem("place-memory-groups-v1", JSON.stringify([{ id: groupId, name: "우리 지도", role: "owner", memberCount: 2 }]));
    localStorage.setItem("place-memory-visits-v2", JSON.stringify([{
      id: visitId, groupId, place: { id: "place", provider: "manual", name: "서울 숲", address: "서울", category: "산책", latitude: 37.54, longitude: 127.04 },
      visitedOn: "2026-10-01", isPlanned: false, title: "함께 산책", note: "함께한 기억", rating: 5,
      tags: [], participants: [], photoUrls: [], markerStyle: "black-9", version: 1, updatedBy: "나",
    }]));
    localStorage.setItem("place-memory-install-prompt-dismissed-v1", "true");
  }, { groupId, visitId });
  await page.goto("/overview");
  await page.getByRole("button", { name: /서울 숲.*함께 산책/ }).click();
  const comments = page.getByRole("region", { name: "기록 댓글" });
  await expect(comments).toContainText("로그인하고 저장소를 연결하면 댓글을 남길 수 있어요.");
  expect(await comments.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByRole("button", { name: "방문 기록 닫기", exact: true }).click();
  await page.goto(`/?groupId=${groupId}&visitId=${visitId}`);
  await expect(page.locator(".place-sheet")).toBeVisible();
  await expect(comments).toContainText("댓글");
  await comments.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("visit-comments.png") });
});
