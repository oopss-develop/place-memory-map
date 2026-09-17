import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1000) > 820, "mobile only");
  await page.addInitScript(() => localStorage.setItem("place-memory-install-prompt-dismissed-v1", "true"));
});

test("selecting a place search result opens its visit form at that place", async ({ page }) => {
  await page.route("**/api/places/search?*", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ results: [{
      id: "kakao-place-1", placeName: "목포 테스트 장소", addressName: "전라남도 목포시", roadAddressName: "전라남도 목포시 해안로", categoryName: "관광명소", latitude: 34.79, longitude: 126.38,
    }] }),
  }));
  await page.goto("/");
  await page.getByRole("button", { name: "장소 검색", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "장소 검색" });
  await search.fill("목포");
  await search.press("Enter");
  await page.getByRole("button", { name: /목포 테스트 장소/ }).click();
  await expect(page.getByRole("dialog", { name: "새 방문 기록" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "목포 테스트 장소" })).toBeVisible();
  await expect(page.locator(".map-focus-pulse")).toHaveCount(0);
  expect(await page.getByLabel("장소 이름", { exact: true }).getAttribute("value")).toBe("목포 테스트 장소");
  await page.getByRole("button", { name: "창 닫기" }).click();
  await expect(page.locator(".map-focus-pulse")).toHaveCount(0);
});

test("search opens a focused modal drawer and offers manual placement after failure", async ({ page }) => {
  await page.route("**/api/places/search?*", (route) => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ error: "검색 연결을 확인해 주세요." }),
  }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "기록" })).toBeHidden();
  const trigger = page.getByRole("button", { name: "장소 검색", exact: true });
  await trigger.click();
  const search = page.getByRole("searchbox", { name: "장소 검색" });
  await expect(search).toBeFocused();
  await expect(page.getByRole("dialog", { name: "기록 목록과 장소 검색" })).toBeVisible();
  await page.getByRole("button", { name: "목록 닫기" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "그룹 메뉴" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "목록 닫기" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await search.fill("없는 장소");
  await search.press("Enter");
  await page.getByRole("button", { name: "찾는 장소가 없나요? 지도에서 직접 선택" }).click();
  await expect(page.getByRole("dialog", { name: "기록 목록과 장소 검색" })).toBeHidden();
  await expect(page.getByText("기록할 위치를 지도에서 선택하세요")).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: "추가 취소" }).click();
  await expect(page.getByText("기록할 위치를 지도에서 선택하세요")).toBeHidden();
  await expect(page.getByRole("navigation").getByRole("button", { name: "지도", exact: true })).toHaveAttribute("aria-current", "page");
});

test("drawer backdrop dismisses without placing a pin", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "지도에 핀 추가" }).click();
  await page.getByRole("button", { name: "기록 목록 열기" }).click();
  await page.locator(".sidebar-backdrop").click({ position: { x: 385, y: 200 } });
  await expect(page.locator(".journal-sidebar")).toBeHidden();
  await expect(page.locator(".visit-dialog")).toBeHidden();
  await expect(page.getByText("기록할 위치를 지도에서 선택하세요")).toBeHidden();
});

test("small phone form keeps save reachable and validation inside the dialog", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.getByRole("button", { name: "지도에 핀 추가" }).click();
  await page.locator(".map-canvas").click({ position: { x: 170, y: 170 } });
  const save = page.getByRole("button", { name: "지도에 기록 남기기" });
  await expect(save).toBeInViewport();
  await page.getByLabel("장소 이름", { exact: true }).fill("모바일 테스트 장소");
  await page.getByLabel("기록 제목").fill("테스트 기록");
  await page.getByLabel("무엇을 했나요?").fill("메모");
  await expect(save).toBeInViewport();
  await expect(page.getByLabel("기록 제목")).toHaveCSS("font-size", "16px");
  // Native required validation passes, but the domain limit rejects a long title.
  await page.getByLabel("기록 제목").fill("가".repeat(121));
  await save.click();
  await expect(page.locator(".visit-dialog").getByRole("alert")).toBeInViewport();
  await page.getByLabel("기록 제목").fill("작은 화면에서 남긴 기억");
  await save.click();
  await expect(page.locator(".visit-dialog")).toBeHidden();
  await expect(page.locator(".place-sheet")).toBeVisible();
  await page.getByRole("button", { name: "기록 크게 보기" }).click();
  await expect(page.getByRole("button", { name: "지도와 함께 보기" })).toHaveAttribute("aria-expanded", "true");
  await page.locator(".sheet-note").scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "상세 닫기" })).toBeInViewport();
  const bounds = await page.locator(".place-sheet").boundingBox();
  const nav = await page.locator(".mobile-nav").boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(nav!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole("button", { name: "상세 닫기" }).click();
  await expect(page.locator(".place-sheet")).toHaveCount(0);
});

test("landscape list and account menu remain scrollable", async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 360 });
  await page.goto("/");
  await page.getByRole("button", { name: "기록 목록 열기" }).click();
  await page.getByRole("button", { name: "그룹 메뉴" }).click();
  await page.getByRole("button", { name: /글꼴 선택/ }).click();
  await page.getByRole("radio", { name: /나눔스퀘어/ }).check();
  await expect(page.locator("html")).toHaveAttribute("data-font", "nanum-square");
  await page.getByRole("button", { name: "목록 닫기" }).click();
  await expect(page.locator(".journal-sidebar")).toBeHidden();
});

test("selected pins bounce and the animation follows the new selection", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("place-memory-visits-v2", JSON.stringify([
      {
        id: "pulse-first", groupId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        place: { id: "pulse-place-first", provider: "manual", name: "첫 번째 파동 장소", address: "서울", category: "산책", latitude: 37.56, longitude: 126.98 },
        visitedOn: "2026-09-16", title: "첫 번째 기록", note: "첫 번째 메모", rating: 5, tags: [], participants: [], photoUrls: [], markerStyle: "black-1", version: 1, updatedBy: "test",
      },
      {
        id: "pulse-second", groupId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        place: { id: "pulse-place-second", provider: "manual", name: "두 번째 파동 장소", address: "서울", category: "카페", latitude: 37.58, longitude: 127.03 },
        visitedOn: "2026-09-15", title: "두 번째 기록", note: "두 번째 메모", rating: 4, tags: [], participants: [], photoUrls: [], markerStyle: "color-4", version: 1, updatedBy: "test",
      },
    ]));
  });
  await page.goto("/");
  await page.locator('[data-visit-id="pulse-first"]').click();
  await expect(page.locator('[data-visit-id="pulse-first"].selected')).toBeVisible();
  await expect(page.locator(".map-focus-pulse")).toHaveCount(0);
  await expect(page.locator('[data-visit-id="pulse-first"].selected')).toHaveCSS("animation-name", "map-pin-bounce");
  await page.locator('[data-visit-id="pulse-second"]').click();
  await expect(page.locator('[data-visit-id="pulse-second"].selected')).toBeVisible();
  await expect(page.locator(".map-focus-pulse")).toHaveCount(0);
  await expect(page.locator('[data-visit-id="pulse-second"].selected')).toHaveCSS("animation-name", "map-pin-bounce");
  await page.getByRole("button", { name: "상세 닫기" }).click();
  await expect(page.locator(".map-focus-pulse")).toHaveCount(0);
});

test("reduced motion keeps the selected pin static", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("place-memory-visits-v2", JSON.stringify([{
      id: "reduced-pulse", groupId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      place: { id: "reduced-pulse-place", provider: "manual", name: "정적인 파동 장소", address: "서울", category: "공원", latitude: 37.56, longitude: 126.98 },
      visitedOn: "2026-09-16", title: "모션 감소 기록", note: "접근성 테스트", rating: 5, tags: [], participants: [], photoUrls: [], markerStyle: "black-1", version: 1, updatedBy: "test",
    }]));
  });
  await page.goto("/");
  await page.locator('[data-visit-id="reduced-pulse"]').click();
  await expect(page.locator(".map-focus-pulse")).toHaveCount(0);
  const pinStyle = await page.locator('[data-visit-id="reduced-pulse"].selected').evaluate((element) => {
    const style = getComputedStyle(element);
    return { animationName: style.animationName, transform: style.transform };
  });
  expect(pinStyle.animationName).toBe("none");
  expect(pinStyle.transform).toContain("matrix");
});
