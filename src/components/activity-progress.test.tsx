import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ActivityProgressProvider, useActivityProgress } from "./activity-progress";
function Source({ active, label }: { active: boolean; label: string }) { useActivityProgress(active, label); return null; }
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("follows theme changes and the newly mounted screen during an active request", async () => {
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (this: Element) {
    return { length: this.getAttribute("hidden") === null ? 1 : 0 } as DOMRectList;
  });
  const scene = (color: string, track: string, name: string) => <ActivityProgressProvider>
    <Source active label="조회 중" />
    <main className="journal-app" hidden style={{ "--primary": "red", "--muted": "pink" } as React.CSSProperties} />
    <main key={name} className="journal-app" data-theme={name} style={{ "--primary": color, "--muted": track } as React.CSSProperties} />
  </ActivityProgressProvider>;
  const { rerender } = render(scene("#166534", "#f4f4f5", "forest"));
  const bar = await screen.findByRole("progressbar");
  await waitFor(() => expect(bar.style.getPropertyValue("--progress-color")).toBe("#166534"));
  rerender(scene("#6d28d9", "#f4f4f5", "forest"));
  await waitFor(() => expect(bar.style.getPropertyValue("--progress-color")).toBe("#6d28d9"));
  rerender(scene("#fafafa", "#27272a", "dark"));
  await waitFor(() => {
    expect(bar.style.getPropertyValue("--progress-color")).toBe("#fafafa");
    expect(bar.style.getPropertyValue("--progress-track")).toBe("#27272a");
  });
});
it("keeps the progress bar while any request is active and clears it on completion or unmount", async () => {
  const { rerender } = render(<ActivityProgressProvider><Source active label="기록 조회 중" /><Source active label="사진 조회 중" /></ActivityProgressProvider>);
  await waitFor(() => expect(screen.getByRole("progressbar")).toBeInTheDocument());
  rerender(<ActivityProgressProvider><Source active={false} label="기록 조회 중" /><Source active label="사진 조회 중" /></ActivityProgressProvider>);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-label", "사진 조회 중");
  rerender(<ActivityProgressProvider><Source active={false} label="기록 조회 중" /></ActivityProgressProvider>);
  await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
});
it("does not show a distracting progress flash for immediately completed work", async () => {
  const { rerender } = render(<ActivityProgressProvider><Source active label="조회 중" /></ActivityProgressProvider>);
  rerender(<ActivityProgressProvider><Source active={false} label="조회 중" /></ActivityProgressProvider>);
  expect(screen.queryByRole("progressbar")).toBeNull();
});
