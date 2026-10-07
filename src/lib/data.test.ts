import { expect, it, vi } from "vitest";
import { readPages } from "./data";

it("reads beyond the 1,000-row API limit without losing records", async () => {
  const rows = Array.from({ length: 1001 }, (_, id) => ({ id }));
  const query = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
  expect(await readPages(query)).toEqual(rows);
  expect(query).toHaveBeenCalledTimes(5);
});

it("does not return a misleading partial result when a later page fails", async () => {
  await expect(readPages(async (from) => ({ data: from ? null : Array.from({ length: 250 }, () => ({})), error: from ? new Error("read failed") : null }))).rejects.toThrow("read failed");
});
