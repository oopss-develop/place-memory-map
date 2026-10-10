import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StickerImage } from "./sticker-image";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const sticker = { id: "a/b.gif", name: "춤", src: "/stickers/a/b.gif?v=1", animated: true };
function motion(reduce: boolean) { vi.stubGlobal("matchMedia", () => ({ matches: reduce, addEventListener: vi.fn(), removeEventListener: vi.fn() })); }
it("does not load a GIF without preview until playback under reduced motion", () => {
  motion(true); const { container } = render(<StickerImage sticker={sticker} />);
  expect(container.querySelector("img")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "춤 재생" }));
  expect(screen.getByAltText("춤")).toHaveAttribute("src", "http://localhost:3000" + sticker.src);
  fireEvent.click(screen.getByRole("button", { name: "춤 정지" }));
  expect(container.querySelector("img")).toBeNull();
});
it("uses the preview under reduced motion and animates normally otherwise", async () => {
  motion(true); render(<StickerImage sticker={{ ...sticker, previewSrc: "/preview.png" }} />);
  expect(screen.getByAltText("춤")).toHaveAttribute("src", "http://localhost:3000/preview.png");
  cleanup(); motion(false);
  render(<StickerImage sticker={sticker} />);
  await waitFor(() => expect(screen.getByAltText("춤")).toHaveAttribute("src", "http://localhost:3000" + sticker.src));
});
it("never autoplays GIFs in the picker and handles missing image files", () => {
  motion(false); render(<StickerImage sticker={{ ...sticker, previewSrc: "/preview.png" }} preview />);
  expect(screen.getByAltText("춤")).toHaveAttribute("src", "http://localhost:3000/preview.png");
  fireEvent.error(screen.getByAltText("춤"));
  expect(screen.getByText("사용할 수 없는 이모티콘")).toBeInTheDocument();
});
