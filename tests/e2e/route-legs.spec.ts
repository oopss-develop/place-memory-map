import { expect, test } from "@playwright/test";
const groupId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(groupId => {
    localStorage.setItem("place-memory-install-prompt-dismissed-v1", "true");
    const trip = { id: "trip", groupId, name: "구간 확인 여행", startDate: "2026-10-01", endDate: "2026-10-01", timeZone: "Asia/Seoul", version: 1 };
    const placeA = { id: "a", provider: "manual", name: "숙소", address: "", category: "", latitude: 37.5, longitude: 127 };
    const placeB = { ...placeA, id: "b", name: "공원", latitude: 37.6, longitude: 127.1 };
    const items = [placeA, placeA, placeB, placeA].map((place, index) => ({ id: `item-${index}`, tripId: trip.id, groupId, place, title: place.name, note: "", startsAt: `2026-10-01T${String(9 + index).padStart(2, "0")}:00`, endsAt: `2026-10-01T${String(10 + index).padStart(2, "0")}:00`, version: 1, markerStyle: "black-9" }));
    localStorage.setItem("place-memory-trips-v1:" + groupId, JSON.stringify({ trips: [trip], items }));
    const key = `${trip.id}|2026-10-01|kakao|v2|${items.map(item => `${item.id}@${item.place.latitude.toFixed(6)},${item.place.longitude.toFixed(6)}`).join("|")}`;
    localStorage.setItem("place-memory-trip-route:" + key, JSON.stringify({ kind: "road", points: [placeA, placeB, placeA].map(({latitude,longitude}) => ({latitude,longitude})), distanceMeters: 25000, durationSeconds: 1980, legs: [{fromItemId:"item-1",toItemId:"item-2",distanceMeters:12000,durationSeconds:900},{fromItemId:"item-2",toItemId:"item-3",distanceMeters:13000,durationSeconds:1080}] }));
  }, groupId);
  await page.goto("/");
  await page.getByRole("button", { name: "여행 계획", exact: true }).filter({visible:true}).click();
});

test("shows ordered segment estimates, same-place stays and return trips after reload", async ({ page }, info) => {
  if (info.project.name === "mobile") await page.getByRole("radio", {name:"지도",exact:true}).click();
  if (info.project.name === "mobile") expect((await page.locator(".planner-map-agenda").boundingBox())!.height).toBeGreaterThanOrEqual(140);
  const legs=page.locator(".planner-route-leg");
  await expect(legs).toHaveCount(3);
  await expect(legs.nth(0)).toHaveText("같은 장소 · 이동 없음");
  await expect(legs.nth(1)).toHaveText("자동차 약 15분 · 12.0km");
  await expect(legs.nth(2)).toHaveText("자동차 약 18분 · 13.0km");
  await legs.nth(1).scrollIntoViewIfNeeded();
  await expect(legs.nth(1)).toBeVisible();
  await page.locator(".planner-map-agenda").screenshot({path:info.outputPath("route-legs.png")});
  await page.locator('.planner-map-canvas [data-visit-id="item-0"]').click();
  await expect(legs).toHaveCount(0);
  await page.getByRole("button", {name:"이 날짜의 모든 장소",exact:true}).click();
  await expect(legs).toHaveCount(3);
  await page.reload();
  await page.getByRole("button", {name:"여행 계획",exact:true}).filter({visible:true}).click();
  if (info.project.name === "mobile") await page.getByRole("radio", {name:"지도",exact:true}).click();
  await expect(legs.nth(1)).toHaveText("자동차 약 15분 · 12.0km");
  await page.getByRole("button", {name:"동선 숨기기",exact:true}).click();
  await expect(legs).toHaveCount(0);
});
