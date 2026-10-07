import { expect, test } from "@playwright/test";
const groupId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const record = { id: "60000000-0000-4000-8000-000000000001", groupId, place: { id: "30000000-0000-4000-8000-000000000001", provider: "manual", name: "서울 숲", address: "서울 성동구", category: "산책", latitude: 37.54, longitude: 127.04 }, visitedOn: "2026-10-01", isPlanned: false, title: "산책", note: "", rating: 5, tags: [], participants: [], photoUrls: [], markerStyle: "black-9", version: 1, updatedBy: "나" };
for (const width of [320, 360, 390]) {
  test(`popup actions stay on one line and fit at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(record => {
      localStorage.setItem("place-memory-visits-v2", JSON.stringify([record]));
      localStorage.setItem("place-memory-theme-v1", "dark");
      localStorage.setItem("place-memory-font-v1", "nanum-square");
      localStorage.setItem("place-memory-install-prompt-dismissed-v1", "true");
    }, record);
    await page.goto("/");
    await page.getByRole("button", { name: "기록 목록 열기" }).click();
    await page.locator(".date-group-toggle").click();
    await page.locator(".record-item").click();
    const zoom = page.getByRole("button", { name: "선택 위치 최대 확대", exact: true });
    await expect(zoom).toBeVisible();
    expect(await zoom.evaluate(el => ({ whiteSpace: getComputedStyle(el).whiteSpace, fits: el.scrollWidth <= el.clientWidth, height: el.getBoundingClientRect().height }))).toMatchObject({ whiteSpace: "nowrap", fits: true });
    await page.getByRole("button", { name: "수정", exact: true }).click();
    const save = page.getByRole("button", { name: "수정 내용 저장", exact: true });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    expect(await save.evaluate(el => ({ whiteSpace: getComputedStyle(el).whiteSpace, fits: el.scrollWidth <= el.clientWidth, height: el.getBoundingClientRect().height }))).toMatchObject({ whiteSpace: "nowrap", fits: true });
    expect(await save.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: info.outputPath(`popup-${width}px.png`) });
    await page.getByRole("button", { name: "창 닫기" }).click();
    await page.getByRole("button", { name: "추가", exact: true }).click();
    await page.locator(".map-canvas").click({ position: { x: 120, y: 260 } });
    const create = page.getByRole("button", { name: "지도에 기록 남기기", exact: true });
    await create.scrollIntoViewIfNeeded();
    await expect(create).toBeInViewport();
    expect(await create.evaluate(el => ({ whiteSpace: getComputedStyle(el).whiteSpace, fits: el.scrollWidth <= el.clientWidth }))).toEqual({ whiteSpace: "nowrap", fits: true });
  });
}
