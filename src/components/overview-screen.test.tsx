import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { aggregateOverview, overviewVisit } from "@/lib/overview";
import type { Visit } from "@/types/domain";
import { OverviewScreen } from "./overview-screen";

vi.mock("./app-link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("opens prepared details immediately and fetches only their comments separately", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  const group = { id: "group", name: "지도", role: "owner" as const, memberCount: 4 };
  const visits: Visit[] = Array.from({ length: 2 }, (_, index) => ({
    id: String(index), groupId: group.id, place: { id: "place", provider: "manual", name: "서울 숲", address: "서울", category: "산책", latitude: 37, longitude: 127 },
    visitedOn: "2026-10-01", title: `산책 ${index}`, note: `기억 ${index}\n두 번째 줄`, rating: 5, tags: ["산책"], participants: [], photoUrls: [`https://example.com/photo-${index}.jpg`], isPlanned: false, markerStyle: "black-9", version: 1, updatedBy: "나",
  }));
  const data = aggregateOverview([group], visits.map(overviewVisit), [], "all");
  data.recentVisits = data.recentVisits.map(recent => ({ ...recent, visit: visits.find(visit => visit.id === recent.id) }));
  const fetchMock = vi.fn().mockImplementation(async (url: string) => Response.json(url.endsWith("/comments") ? { comments: [] } : data));
  vi.stubGlobal("fetch", fetchMock);
  render(<OverviewScreen userId="user" />);
  const first = await screen.findByRole("button", { name: /서울 숲.*산책 0/ });
  fireEvent.click(first);
  expect(screen.getByRole("region", { name: "방문 기록" })).toHaveTextContent("기억 0");
  expect(screen.getByAltText("서울 숲 방문 사진 1")).toHaveAttribute("src", visits[0].photoUrls[0]);
  expect(screen.queryByText("기록을 불러오는 중…")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /서울 숲.*산책 1/ }));
  expect(screen.getByRole("region", { name: "방문 기록" })).toHaveTextContent("기억 1");
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(fetchMock.mock.calls.filter(([url]) => !url.endsWith("/comments"))).toHaveLength(1);
});
