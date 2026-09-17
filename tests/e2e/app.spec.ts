import { expect, test } from "@playwright/test";

test("shows an empty map journal", async ({ page }) => {
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1000) <= 820) await page.getByRole("button", { name: "기록 목록 열기" }).click();
  await expect(page.getByRole("heading", { name: "기록" })).toBeVisible();
  await expect(page.getByText("아직 남긴 발자국이 없어요.")).toBeVisible();
});

test("mobile search opens with account submenus closed", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1000) > 820, "mobile only");
  await page.addInitScript(() => localStorage.setItem("place-memory-install-prompt-dismissed-v1", "true"));
  await page.goto("/");
  await page.getByRole("button", { name: "기록 목록 열기" }).click();
  await page.getByRole("button", { name: "그룹 메뉴" }).click();
  await expect(page.locator(".group-menu")).toBeVisible();
  await page.getByRole("button", { name: "목록 닫기" }).click();
  await page.getByRole("button", { name: "장소 검색" }).click();
  await expect(page.locator(".group-menu")).toHaveCount(0);
  await expect(page.getByRole("searchbox", { name: "장소 검색" })).toBeFocused();
});

test("manual pin opens the visit form", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "지도에 핀 추가" }).click();
  await page.locator(".map-canvas").click({ position: { x: 220, y: 180 }, force: true });
  await expect(page.getByRole("heading", { name: "이 위치에 이름을 붙여주세요" })).toBeVisible();
  await expect(page.locator(".member-checks label")).toContainText(["또이교혁", "나박나린", "우박우성", "쥐이은지"]);
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
  if ((page.viewportSize()?.width ?? 1000) <= 820) await page.getByRole("button", { name: "기록 목록 열기" }).click();
  await expect(page.getByText("나린의 지도")).toBeVisible();
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

test("a marker shape can be selected and edited", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "지도에 핀 추가" }).click();
  await page.locator(".map-canvas").click({ position: { x: 220, y: 180 }, force: true });
  await expect(page.getByRole("radio", { name: /핀/ })).toHaveCount(44);
  await page.getByTitle("핀 44", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "핀 44", exact: true })).toBeChecked();
  await page.getByRole("radio", { name: "10점", exact: true }).click();
  await expect(page.getByRole("radio", { name: "10점", exact: true })).toBeChecked();
  await page.getByLabel("장소 이름").fill("모양이 다른 핀");
  await page.getByLabel("기록 제목").fill("네 번째 핀 선택");
  await page.getByRole("button", { name: "지도에 기록 남기기" }).click();

  const marker = page.locator('[data-visit-id]').filter({ has: page.locator('img') }).first();
  await expect(marker).toHaveAttribute("data-marker-style", "round-gamepad-black");
  await marker.click();
  await page.getByRole("button", { name: "기록 고치기" }).click();
  await expect(page.getByRole("radio", { name: "핀 44", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "10점", exact: true })).toBeChecked();
});

test("mobile visit popup stays within the viewport", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1000) > 820, "mobile only");
  await page.addInitScript(() => {
    localStorage.setItem("place-memory-visits-v2", JSON.stringify([{
      id: "narrow-popup-visit",
      groupId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      place: { id: "narrow-popup-place", provider: "manual", name: "아주아주아주아주아주아주긴장소이름입니다", address: "전라남도 무안군 무안읍 면성2길 61 아주 긴 주소 설명", category: "음식점 > 한식", latitude: 37.56, longitude: 126.98 },
      visitedOn: "2026-09-16",
      title: "긴 제목도 화면을 넘어가지 않아야 합니다",
      note: "긴 메모가 모바일에서 자연스럽게 줄바꿈되어야 합니다.",
      rating: 5,
      tags: ["맛집", "테스트"],
      participants: [],
      photoUrls: [],
      markerStyle: "black-1",
      version: 1,
      updatedBy: "test",
    }]));
    localStorage.setItem("place-memory-install-prompt-dismissed-v1", "true");
  });
  await page.goto("/");
  await page.locator('[data-visit-id="narrow-popup-visit"]').click();
  await expect(page.locator(".place-sheet.is-positioned")).toBeVisible();
  const dimensions = await page.evaluate(() => {
    const sheet = document.querySelector(".place-sheet") as HTMLElement;
    const marker = document.querySelector('[data-visit-id="narrow-popup-visit"]') as HTMLElement;
    return { documentWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth, sheetWidth: sheet?.scrollWidth, sheetClientWidth: sheet?.clientWidth, sheetTop: sheet?.getBoundingClientRect().top, markerBottom: marker?.getBoundingClientRect().bottom };
  });
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.sheetWidth).toBeLessThanOrEqual(dimensions.sheetClientWidth);
  expect(dimensions.markerBottom).toBeLessThan(dimensions.sheetTop - 24);
});

test("reselecting a record reopens its popup", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("place-memory-visits-v2", JSON.stringify([{
      id: "repeat-selection-visit",
      groupId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      place: { id: "repeat-selection-place", provider: "manual", name: "다시 여는 장소", address: "서울", category: "산책", latitude: 37.56, longitude: 126.98 },
      visitedOn: "2026-09-16",
      title: "같은 기록 다시 선택",
      note: "팝업 재선택 테스트",
      rating: 5,
      tags: ["산책"],
      participants: [],
      photoUrls: [],
      markerStyle: "black-1",
      version: 1,
      updatedBy: "test",
    }]));
    localStorage.setItem("place-memory-install-prompt-dismissed-v1", "true");
  });
  await page.goto("/");

  const mobile = (page.viewportSize()?.width ?? 1000) <= 820;
  if (mobile) await page.getByRole("button", { name: "기록 목록 열기" }).click();
  await page.getByRole("button", { name: /9월 16일.*방문 기록 1개/ }).click();
  await page.locator(".record-item", { hasText: "다시 여는 장소" }).click();
  await expect(page.locator(".place-sheet.is-positioned")).toBeVisible();
  await page.locator(".map-canvas").click({ position: { x: 20, y: 200 } });
  await expect(page.locator(".place-sheet.is-positioned")).toBeHidden();

  if (mobile) await page.getByRole("button", { name: "기록 목록 열기" }).click();
  await page.locator(".record-item", { hasText: "다시 여는 장소" }).click();
  await expect(page.locator(".place-sheet.is-positioned")).toBeVisible();
});

test("theme choice is applied and remembered", async ({ page }) => {
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1000) <= 820) await page.getByRole("button", { name: "기록 목록 열기" }).click();
  await page.getByRole("button", { name: "그룹 메뉴" }).click();
  await page.getByRole("button", { name: /테마 선택/ }).click();
  await page.getByRole("radio", { name: /다크/ }).click();
  await expect(page.locator(".journal-app")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator(".journal-app")).toHaveAttribute("data-theme", "dark");
});

test("font preference loads the font, survives reload and remains independent of theme", async ({ page }) => {
  await page.goto("/");
  const mobile = (page.viewportSize()?.width ?? 1000) <= 820;
  if (mobile) await page.getByRole("button", { name: "기록 목록 열기" }).click();
  await page.getByRole("button", { name: "그룹 메뉴" }).click();
  await page.getByRole("button", { name: /글꼴 선택/ }).click();
  await page.getByRole("radio", { name: /나눔스퀘어/ }).check();
  await expect(page.locator("html")).toHaveAttribute("data-font", "nanum-square");
  const fontLoaded = await page.evaluate(async () => (await document.fonts.load('400 15px "NanumSquare"', '오늘의 기억')).length > 0);
  expect(fontLoaded).toBe(true);
  await expect(page.locator(".record-heading h1")).toHaveCSS("font-family", /NanumSquare/);
  await page.getByRole("button", { name: /글꼴 선택/ }).click();
  await page.getByRole("button", { name: /테마 선택/ }).click();
  await page.getByRole("radio", { name: /다크/ }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-font", "nanum-square");
  await expect(page.locator(".journal-app")).toHaveAttribute("data-theme", "dark");
  if (mobile) await page.getByRole("button", { name: "기록 목록 열기" }).click();
  await page.getByRole("button", { name: "그룹 메뉴" }).click();
  await page.getByRole("button", { name: /글꼴 선택/ }).click();
  await page.getByRole("radio", { name: /노토 산스/ }).check();
  await expect(page.locator("html")).toHaveAttribute("data-font", "noto");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-font", "noto");
});

test("planned visit filter shows only planned records", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("place-memory-visits-v2", JSON.stringify([
      { id: "planned-visit", groupId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", place: { id: "planned-place", provider: "manual", name: "방문 예정 장소", address: "서울", category: "카페", latitude: 37.56, longitude: 126.98 }, visitedOn: "2026-09-20", isPlanned: true, title: "다음 주에 가기", note: "", rating: 5, tags: ["약속"], participants: [], photoUrls: [], markerStyle: "black-1", version: 1, updatedBy: "test" },
      { id: "completed-visit", groupId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", place: { id: "completed-place", provider: "manual", name: "이미 다녀온 장소", address: "서울", category: "식당", latitude: 37.57, longitude: 126.99 }, visitedOn: "2026-09-20", isPlanned: false, title: "지난 기록", note: "", rating: 4, tags: ["추억"], participants: [], photoUrls: [], markerStyle: "black-2", version: 1, updatedBy: "test" },
    ]));
    localStorage.setItem("place-memory-install-prompt-dismissed-v1", "true");
  });
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1000) <= 820) await page.getByRole("button", { name: "기록 목록 열기" }).click();
  await expect(page.getByRole("button", { name: "방문 예정", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "방문 예정", exact: true }).click();
  await expect(page.getByText("1개의 방문 기록")).toBeVisible();
  await page.getByRole("button", { name: /방문 기록 1개/ }).click();
  await expect(page.locator(".record-item")).toHaveCount(1);
  await expect(page.locator(".record-item")).toContainText("방문 예정 장소");
  await expect(page.locator(".record-item")).not.toContainText("이미 다녀온 장소");
});
