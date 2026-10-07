import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("preserves Korean keyword composition and submits the original masked value", async () => {
  const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  render(<LoginForm />);
  fireEvent.change(screen.getByLabelText("등록된 이메일"), { target: { value: "member@example.test" } });
  const keyword = screen.getByLabelText("키워드", { exact: true });
  expect(keyword).toHaveAttribute("type", "text");
  expect(keyword).toHaveAttribute("data-masked", "true");
  fireEvent.compositionStart(keyword);
  fireEvent.change(keyword, { target: { value: "우리여행" } });
  fireEvent.submit(keyword.closest("form")!);
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.compositionEnd(keyword, { data: "우리여행" });
  fireEvent.click(screen.getByRole("button", { name: "키워드 표시" }));
  expect(keyword).toHaveValue("우리여행");
  expect(keyword).toHaveAttribute("data-masked", "false");
  fireEvent.click(screen.getByRole("button", { name: "키워드 숨기기" }));
  expect(keyword).toHaveValue("우리여행");
  fireEvent.submit(keyword.closest("form")!);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ keyword: "우리여행" });
});
