import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CommentNotifications } from "./comment-notifications";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("links to the exact comment, removes read alerts and retains recent activity", async () => {
  HTMLDialogElement.prototype.showModal = function() { this.setAttribute("open", ""); };
  const recent = { commentId: "c", visitId: "v", groupId: "g", body: "기억", authorName: "뚜냥", placeName: "숲", createdAt: "2026-10-10T10:00:00Z", readAt: null, own: false, stickerName: null };
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ notifications: [recent], unreadCount: 1 }));
  vi.stubGlobal("fetch",fetchMock);
  render(<CommentNotifications />);
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "댓글 알림" }));
  const link = await screen.findByRole("link");
  expect(link).toHaveAttribute("href", "/?groupId=g&visitId=v&commentId=c#comment-c");
  fireEvent(window, new CustomEvent("comment-notification-read", { detail: "c" }));
  await waitFor(() => expect(screen.queryByRole("link")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "최근 댓글" }));
  expect(screen.getByRole("link")).toHaveTextContent("기억");
  expect(screen.queryByText("새 댓글")).toBeNull();
});
it("offers retry when loading fails", async () => {
  HTMLDialogElement.prototype.showModal = function() { this.setAttribute("open", ""); };
  vi.stubGlobal("fetch",vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(Response.json({ notifications: [], unreadCount: 0 })));
  render(<CommentNotifications />); fireEvent.click(screen.getByRole("button", { name: "댓글 알림" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
  await screen.findByText("모든 댓글 소식을 확인했어요.");
});
