import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StickerPicker } from "./sticker-picker";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("shows all previews and saves per-account favorites without selecting a sticker", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const sticker = { id: "series/hi.gif", name: "안녕", src: "/hi.gif", previewSrc: "/hi.png", animated: true };
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ series: [{ id: "series", name: "시리즈", stickers: [sticker] }], signedIn: true, favorites: [] })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch",fetchMock); const select = vi.fn(); render(<StickerPicker onSelect={select} />);
  await screen.findByAltText("안녕");
  expect(screen.getByRole("button", { name: /^전체$/ })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByAltText("안녕").getAttribute("src")).toContain("/hi.png");
  fireEvent.click(screen.getByRole("button", { name: "안녕 즐겨찾기 추가" }));
  await screen.findByRole("button", { name: "안녕 즐겨찾기 해제" });
  expect(select).not.toHaveBeenCalled();
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ stickerId: sticker.id, favorite: true });
  fireEvent.click(screen.getByRole("button", { name: "★ 즐겨찾기" }));
  expect(screen.getByRole("button", { name: "안녕 선택" })).toBeInTheDocument();
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "offline" }), { status: 503 }));
  fireEvent.click(screen.getByRole("button", { name: "안녕 즐겨찾기 해제" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("offline"));
  expect(screen.getByRole("button", { name: "안녕 즐겨찾기 해제" })).toBeInTheDocument();
});
