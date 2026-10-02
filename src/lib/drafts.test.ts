import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearUserDrafts, formValues, listDrafts, saveDraft } from "./drafts";
beforeEach(()=>localStorage.clear());
afterEach(()=>vi.restoreAllMocks());
describe("private editor drafts",()=>{
  it("isolates users and maps, and clears only the signed-out user's drafts",()=>{
    saveDraft("u1:visit:g1:new",{title:"입력"}); saveDraft("u1:visit:g2:new",{}); saveDraft("u2:visit:g1:new",{});
    expect(listDrafts("u1:visit:g1:")).toHaveLength(1);
    clearUserDrafts("u1"); expect(listDrafts("u1:")).toEqual([]); expect(listDrafts("u2:")).toHaveLength(1);
  });
  it("expires after seven days and safely ignores corrupt data",()=>{
    vi.spyOn(Date,"now").mockReturnValue(1000); saveDraft("u:visit:g:new",{});
    vi.spyOn(Date,"now").mockReturnValue(1000+7*86400000+1);
    localStorage.setItem("place-memory-draft-v1:bad","{bad");
    expect(listDrafts("u:")).toEqual([]); expect(localStorage.length).toBe(0);
  });
  it("captures repeated text fields and excludes uploaded files",()=>{
    const form=document.createElement("form"); form.innerHTML='<input name="title" value="기록"><input name="tags" value="산책"><input name="tags" value="맛집"><input type="file" name="photos">';
    expect(formValues(form)).toEqual({title:["기록"],tags:["산책","맛집"]});
  });
});
