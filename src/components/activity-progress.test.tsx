import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ActivityProgressProvider, useActivityProgress } from "./activity-progress";
function Source({ active, label }: { active: boolean; label: string }) { useActivityProgress(active, label); return null; }
afterEach(cleanup);
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
