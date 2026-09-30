import { afterEach, describe, expect, it, vi } from "vitest";
import { getAllowedMemberCredential, getAllowedMembers, parseAllowedMembers } from "@/lib/access-auth";

const members = Array.from({ length: 4 }, (_, index) => ({ email: `person${index}@example.com`, displayName: `사용자 ${index}`, keyword: `키워드${index}` }));
const json = JSON.stringify(members);
afterEach(() => vi.unstubAllEnvs());

describe("allowed member environment values", () => {
  it.each([json, `  '${json}'  `, JSON.stringify(json)])("accepts raw, quoted and JSON-encoded arrays", (raw) => {
    expect(parseAllowedMembers(raw)).toHaveLength(4);
    vi.stubEnv("ALLOWED_MEMBERS_JSON", raw);
    vi.stubEnv("ALLOWED_MEMBER_KEYS_JSON", raw);
    expect(getAllowedMembers()).toHaveLength(4);
    expect(getAllowedMemberCredential("PERSON0@example.com", "키워드0")).toMatchObject({ email: "person0@example.com" });
    expect(getAllowedMemberCredential("person0@example.com", "틀린 키워드")).toBeNull();
  });

  it("can use the quoted keyword list when the member list is absent", () => {
    vi.stubEnv("ALLOWED_MEMBERS_JSON", "");
    vi.stubEnv("ALLOWED_MEMBER_KEYS_JSON", `'${json}'`);
    expect(getAllowedMembers()).toHaveLength(4);
  });

  it("rejects malformed values and deduplicates emails", () => {
    for (const raw of ["", "not JSON", "{}", "null", `'${json}`, JSON.stringify("not JSON")]) {
      expect(parseAllowedMembers(raw)).toEqual([]);
      vi.stubEnv("ALLOWED_MEMBER_KEYS_JSON", raw);
      expect(getAllowedMemberCredential("person0@example.com", "키워드0")).toBeNull();
    }
    expect(parseAllowedMembers(JSON.stringify([members[0], { ...members[0], email: " PERSON0@EXAMPLE.COM " }]))).toHaveLength(1);
  });
});
