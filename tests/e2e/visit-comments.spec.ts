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
  await page.setViewportSize({ width: test.info().project.name === "mobile" ? 320 : 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/stickers", route => route.fulfill({ json: { signedIn: true, favorites: [], series: Array.from({ length: 24 }, (_, i) => ({ id: String(i), name: i === 0 ? "우삼" : i === 1 ? "뚜냥" : "시리즈" + i, stickers: Array.from({ length: 20 }, (_, j) => ({ id: i + "/" + j + ".gif", name: "안녕" + j, src: "/stickers/fixture.gif?v=1", previewSrc: "/stickers/fixture.gif?v=preview", animated: true })) })) } }));
  await page.route("**/stickers/fixture.gif?*", route => route.fulfill({ contentType: "image/gif", body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64") }));
  await page.goto("/overview");
  await page.getByRole("button", { name: /서울 숲.*함께 산책/ }).click();
  const comments = page.getByRole("region", { name: "기록 댓글" });
  await expect(comments).toContainText("로그인하고 저장소를 연결하면 댓글을 남길 수 있어요.");
  await comments.getByRole("button", { name: "이모티콘 둘러보기" }).click();
  await expect(comments.getByAltText("안녕0").first()).toBeVisible();
  const tabs = page.locator(".sticker-series");
  await tabs.scrollIntoViewIfNeeded();
  const bounds = await tabs.boundingBox();
  if (!bounds) throw new Error("Tabs are not visible");
  await page.mouse.move(bounds.x + bounds.width - 15, bounds.y + 20);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 10, bounds.y + 20, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => tabs.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await comments.getByRole("button", { name: "뚜냥", exact: true }).click();
  await expect(comments.getByRole("button", { name: "뚜냥", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await comments.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.locator(".sticker-series").evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await page.locator(".sticker-grid").evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  await comments.getByRole("button", { name: "크게 보기" }).click();
  const full = page.getByRole("dialog", { name: "이모티콘 전체보기" });
  await expect(full).toBeVisible();
  expect(await full.evaluate(el => el.getBoundingClientRect().width <= window.innerWidth)).toBe(true);
  await full.getByRole("button", { name: "안녕0 선택", exact: true }).click();
  await expect(full).toHaveCount(0);
  await expect(comments.locator("img")).toHaveCount(1);
  await comments.getByRole("button", { name: "안녕0 재생" }).click();
  await expect(comments.getByAltText("안녕0")).toBeVisible();
  await comments.getByRole("button", { name: "안녕0 정지" }).click();
  await expect(comments.locator("img")).toHaveCount(1);
  await page.getByRole("button", { name: "방문 기록 닫기", exact: true }).click();
  await page.goto(`/?groupId=${groupId}&visitId=${visitId}`);
  await expect(page.locator(".place-sheet")).toBeVisible();
  await expect(comments).toContainText("댓글");
  await comments.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("visit-comments.png") });
});

test("keeps long record details scrollable through the comment section", async ({ page }, info) => {
  const mobile = info.project.name === "mobile";
  await page.setViewportSize({ width: mobile ? 320 : 1280, height: 600 });
  await page.addInitScript(({ groupId, visitId }) => {
    localStorage.setItem("place-memory-groups-v1", JSON.stringify([{ id: groupId, name: "우리 지도", role: "owner", memberCount: 2 }]));
    localStorage.setItem("place-memory-visits-v2", JSON.stringify([{
      id: visitId, groupId, place: { id: "place", provider: "manual", name: "서울 숲", address: "서울", category: "산책", latitude: 37.54, longitude: 127.04 },
      visitedOn: "2026-10-01", isPlanned: false, title: "긴 기록", note: "함께 걸으며 남긴 긴 기억\n".repeat(70), rating: 5,
      tags: [], participants: [], photoUrls: [], markerStyle: "black-9", version: 1, updatedBy: "나",
    }]));
    localStorage.setItem("place-memory-install-prompt-dismissed-v1", "true");
  }, { groupId, visitId });
  await page.goto(`/?groupId=${groupId}&visitId=${visitId}`);
  const sheet = page.locator(".place-sheet");
  const body = page.locator(".sheet-body");
  await expect(sheet).toBeVisible();
  await expect(page.getByRole("button", { name: "여행 일정에 넣기" })).toHaveCount(0);
  async function checkScroll() {
    await expect.poll(() => body.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    const box = await body.boundingBox();
    if (!box) throw new Error("Record body is not visible");
    await body.evaluate(element => { element.scrollTop = 0; });
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(page.getByRole("region", { name: "기록 댓글" })).toBeInViewport();
    const withinMap = await sheet.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const stage = element.closest(".map-stage")!.getBoundingClientRect();
      return rect.top >= stage.top && rect.bottom <= stage.bottom;
    });
    expect(withinMap).toBe(true);
  }
  await checkScroll();
  const actionLayout = await page.locator(".sheet-actions").evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const buttons = [...element.querySelectorAll("button")].map(button => button.getBoundingClientRect());
    return buttons.length === 3 && buttons.every(button => Math.abs(button.top - buttons[0].top) < 1 && Math.abs(button.height - buttons[0].height) < 1 && button.left >= bounds.left && button.right <= bounds.right + 1);
  });
  expect(actionLayout).toBe(true);
  if (mobile) {
    await page.getByRole("button", { name: "기록 크게 보기" }).click();
    await checkScroll();
    await page.getByRole("button", { name: "지도와 함께 보기" }).click();
    await checkScroll();
  }
  await page.screenshot({ path: test.info().outputPath("scroll-to-comments.png") });
});
