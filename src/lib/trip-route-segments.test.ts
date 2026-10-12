import { describe, expect, it } from "vitest";
import { orderedRouteStops, routeLegs, formatRouteDuration } from "./trip-route-segments";
const a = { id: "a1", name: "A", latitude: 37, longitude: 127 };
const b = { id: "b1", name: "B", latitude: 38, longitude: 128 };
describe("route legs", () => {
  it("merges consecutive stays and preserves returning visits", () => {
    const stops = orderedRouteStops([a, { ...a, id: "a2" }, b, { ...a, id: "a3" }]);
    expect(stops.map(stop => stop.itemIds)).toEqual([["a1", "a2"], ["b1"], ["a3"]]);
    expect(routeLegs(stops, [{ distance: 1000, duration: 600 }, { distance: 1200, duration: 720 }])).toEqual([
      { fromItemId: "a2", toItemId: "b1", distanceMeters: 1000, durationSeconds: 600 },
      { fromItemId: "b1", toItemId: "a3", distanceMeters: 1200, durationSeconds: 720 },
    ]);
  });
  it("omits incomplete and invalid sections without shifting pair assignments", () => {
    const stops = orderedRouteStops([a, b, { ...a, id: "a3" }]);
    expect(routeLegs(stops, [{ distance: 1000, duration: 600 }])).toEqual([]);
    expect(routeLegs(stops, [{ distance: -1, duration: 600 }, { distance: 1200, duration: 720 }])).toEqual([
      { fromItemId: "b1", toItemId: "a3", distanceMeters: 1200, durationSeconds: 720 },
    ]);
  });
  it("formats short and long estimates", () => {
    expect(formatRouteDuration(30)).toBe("1분 미만");
    expect(formatRouteDuration(900)).toBe("15분");
    expect(formatRouteDuration(3900)).toBe("1시간 5분");
  });
});
