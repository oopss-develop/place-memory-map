import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { VisitComments } from "./visit-comments";
vi.mock("./confirmation", () => ({ useConfirmation: () => ({ confirm: async () => true, dialog: null }) }));
vi.mock("./ui/button", () => ({ Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => { const { variant, size, ...rest } = props; void variant; void size; return <button {...rest} />; } }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
it("keeps failed input and retries with the same UUID before clearing after success", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ comments: [] }))
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(response({ ok: true }))
    .mockResolvedValueOnce(response({ comments: [{ id: "c", body: "좋았어요", authorName: "우삼", createdAt: "2026-10-10T10:00:00Z", own: true }] }));
  vi.stubGlobal("fetch", fetchMock);
  render(<VisitComments visitId="visit" />);
  await screen.findByText("이 기록에 첫 댓글을 남겨 보세요.");
  const input = screen.getByLabelText("댓글 남기기");
  fireEvent.change(input, { target: { value: "좋았어요" } });
  fireEvent.click(screen.getByRole("button", { name: "댓글 등록" }));
  await screen.findByRole("alert");
  expect(input).toHaveValue("좋았어요");
  fireEvent.click(screen.getByRole("button", { name: "댓글 등록" }));
  await screen.findByText("우삼");
  expect(input).toHaveValue("");
  expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[2][1].body);
});
it("offers deletion only for the author's own comments and removes one after confirmation", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ comments: [
    { id: "mine", body: "내 댓글", authorName: "우삼", createdAt: "2026-10-10T10:00:00Z", own: true },
    { id: "other", body: "다른 댓글", authorName: "뚜냥", createdAt: "2026-10-10T10:00:00Z", own: false },
  ] })).mockResolvedValueOnce(response({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  render(<VisitComments visitId="visit" />);
  const remove = await screen.findByRole("button", { name: "우삼님의 댓글 삭제" });
  expect(screen.queryByRole("button", { name: "뚜냥님의 댓글 삭제" })).toBeNull();
  fireEvent.click(remove);
  await waitFor(() => expect(screen.queryByText("내 댓글")).toBeNull());
  expect(screen.getByText("다른 댓글")).toBeInTheDocument();
  expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
});
