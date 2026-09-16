import { describe, expect, it } from "vitest";
import { getMemberInitials } from "@/lib/member-initials";

describe("getMemberInitials", () => {
  it.each([
    ["이교혁", "또"],
    ["박나린", "나"],
    ["박우성", "우"],
    ["이은지", "쥐"],
  ])("maps %s to %s", (name, initials) => {
    expect(getMemberInitials(name)).toBe(initials);
  });

  it("falls back to the first character for another member", () => {
    expect(getMemberInitials("홍길동")).toBe("홍");
  });
});
