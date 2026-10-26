import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 390, height: 844 }, { width: 412, height: 915 }, { width: 740, height: 360 }]) {
  test(`mobile drawer scrolls as one list at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "mobile drawer");
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      const groupId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      localStorage.setItem("place-memory-install-prompt-dismissed-v1", "true");
      localStorage.setItem("place-memory-groups-v1", JSON.stringify([{ id: groupId, name: "우리 지도", role: "owner", memberCount: 2 }]));
      localStorage.setItem("place-memory-visits-v2", JSON.stringify(Array.from({ length: 20 }, (_, index) => ({
        id: `scroll-visit-${index}`, groupId,
        place: { id: `scroll-place-${index}`, provider: "manual", name: `스크롤 장소 ${index + 1}`, address: "서울", category: "산책", latitude: 37.54 + index * 0.001, longitude: 127.04 },
        visitedOn: "2026-10-01", isPlanned: false, title: `함께 남긴 기록 ${index + 1}`, note: "", rating: 5, tags: [], participants: [], photoUrls: [], markerStyle: "black-9", version: 1, updatedBy: "나",
      }))));
    });
    await page.goto("/");
    await page.getByRole("button", { name: "기록 목록 열기" }).click();
    const drawer = page.getByRole("dialog", { name: "기록 목록과 장소 검색" });
    await drawer.getByRole("radio", { name: "저장된 기록", exact: true }).click();
    const records = drawer.locator(".record-item");
    await expect(records).toHaveCount(20);
    // Scroll from the controls, then from the records: both move the same drawer.
    await drawer.locator(".record-heading").scrollIntoViewIfNeeded();
    const before = await drawer.evaluate(el => el.scrollTop);
    await drawer.locator(".record-heading").hover();
    await page.mouse.wheel(0, 450);
    await expect.poll(() => drawer.evaluate(el => el.scrollTop)).toBeGreaterThan(before);
    expect(await drawer.locator(".record-list").evaluate(el => getComputedStyle(el).overflowY)).toBe("visible");
    if (viewport.height > 600) {
      const visibleCount = await records.evaluateAll(elements => elements.filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= innerHeight;
      }).length);
      expect(visibleCount).toBeGreaterThanOrEqual(3);
    }
    await records.last().scrollIntoViewIfNeeded();
    await expect(records.last()).toBeInViewport();
    await drawer.getByRole("button", { name: "그룹 메뉴", exact: true }).click();
    await drawer.getByRole("button", { name: "로그아웃", exact: true }).scrollIntoViewIfNeeded();
    await expect(drawer.getByRole("button", { name: "로그아웃", exact: true })).toBeInViewport();
    expect(await drawer.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "기록 목록 열기" }).click();
    await drawer.locator(".record-heading").scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath("mobile-records-scroll.png") });
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });
}
