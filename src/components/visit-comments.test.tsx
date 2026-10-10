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
it("switches series, sends sticker-only and mixed comments, and preserves failed selections", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const sticker = { id: "02_뚜냥/01_좋아요.png", name: "좋아요", src: "/good.png", animated: false };
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ comments: [] }))
    .mockResolvedValueOnce(response({ series: [ { id: "01_우삼", name: "우삼", stickers: [] }, { id: "02_뚜냥", name: "뚜냥", stickers: [sticker] } ] }))
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(response({ ok: true })).mockResolvedValueOnce(response({ comments: [{ id: "c", body: "", stickerId: sticker.id, sticker, authorName: "나", own: true, createdAt: "2026-10-10" }] }));
  vi.stubGlobal("fetch", fetchMock); render(<VisitComments visitId="visit" />);
  await screen.findByText("이 기록에 첫 댓글을 남겨 보세요.");
  fireEvent.click(screen.getByRole("button", { name: "이모티콘 선택" }));
  fireEvent.click(await screen.findByRole("button", { name: "뚜냥" }));
  fireEvent.click(screen.getByRole("button", { name: "좋아요 선택" }));
  fireEvent.click(screen.getByRole("button", { name: "댓글 등록" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "선택 취소" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "댓글 등록" }));
  await screen.findByText("나");
  expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[3][1].body);
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({ body: "", stickerId: sticker.id });
  expect(screen.queryByRole("button", { name: "선택 취소" })).toBeNull();
  fetchMock.mockResolvedValueOnce(response({ series: [{ id: "02_뚜냥", name: "뚜냥", stickers: [sticker] }] }));
  fireEvent.click(screen.getByRole("button", { name: "이모티콘 선택" }));
  fireEvent.click(await screen.findByRole("button", { name: "좋아요 선택" }));
  fireEvent.change(screen.getByLabelText("댓글 남기기"), { target: { value: "함께" } });
  fetchMock.mockResolvedValueOnce(response({ ok: true })).mockResolvedValueOnce(response({ comments: [] }));
  fireEvent.click(screen.getByRole("button", { name: "댓글 등록" }));
  await waitFor(() => expect(screen.getByLabelText("댓글 남기기")).toHaveValue(""));
  expect(JSON.parse(fetchMock.mock.calls[6][1].body)).toMatchObject({ body: "함께", stickerId: sticker.id });
});
it("retains text and shows a fallback for removed stickers", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ comments: [{ id: "c", body: "기억", stickerId: "gone/a.png", sticker: null, authorName: "나", createdAt: "2026-10-10", own: false }] })));
  render(<VisitComments visitId="visit" />);
  await screen.findByText("사용할 수 없는 이모티콘"); expect(screen.getByText("기억")).toBeInTheDocument();
});
it("scrolls to the linked comment and marks it read only once it is visible", async () => {
  const id = "10000000-0000-4000-8000-000000000001";
  window.history.replaceState({}, "", `/?commentId=${id}`);
  const scroll = vi.fn();
  HTMLElement.prototype.scrollIntoView = scroll;
  let observerCallback: IntersectionObserverCallback | undefined;
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { observerCallback = callback; }
    observe = vi.fn(); disconnect = vi.fn();
  });
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ comments: [{ id, body: "목표 댓글", authorName: "뚜냥", createdAt: "2026-10-10", own: false }] })).mockResolvedValueOnce(response({ ok: true }));
  vi.stubGlobal("fetch",fetchMock);
  try {
    render(<VisitComments visitId="visit" />);
    await screen.findByText("목표 댓글");
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    await screen.findByText("댓글 알림을 확인했어요.");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/comment-notifications");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ commentId: id });
  } finally { window.history.replaceState({}, "", "/"); }
});
