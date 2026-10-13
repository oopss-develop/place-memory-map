import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoryBoard } from "./use-memory-board";
import type { BoardItem } from "./memory-board";
const item:BoardItem={id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",kind:"note",x:110,y:100,width:230,height:210,rotation:-5,text:"우리의 기억",color:"cream",attachment:"tape"};
beforeEach(()=>localStorage.clear());
afterEach(()=>vi.unstubAllGlobals());
describe("shared board saving",()=>{
  it("restores an unsaved draft even when the initial shared-board request is offline",async()=>{
    localStorage.setItem("uttumak-board-draft-v1:user:g",JSON.stringify({at:Date.now(),board:{background:"pegboard",items:[item],version:2}}));
    vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new TypeError("offline")));
    const {result}=renderHook(()=>useMemoryBoard("g","user",false));
    await waitFor(()=>expect(result.current.loading).toBe(false));
    expect(result.current.board.items).toHaveLength(1);expect(result.current.dirty).toBe(true);expect(result.current.error).toContain("연결");
  });
  it("keeps local edits after a conflict and makes explicitly loaded data reversible",async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({board:{background:"pegboard",items:[],version:1}})))
      .mockResolvedValueOnce(new Response(JSON.stringify({error:"다른 멤버가 먼저 수정했습니다."}),{status:409}))
      .mockResolvedValueOnce(new Response(JSON.stringify({board:{background:"whiteboard",items:[],version:2}})));
    vi.stubGlobal("fetch",fetch);
    const {result}=renderHook(()=>useMemoryBoard("g","user",false));
    await waitFor(()=>expect(result.current.loading).toBe(false));
    act(()=>result.current.change({background:"pegboard",items:[item]}));
    await act(()=>result.current.save());
    expect(result.current.conflict).toBe(true);expect(result.current.board.items).toHaveLength(1);
    expect(localStorage.getItem("uttumak-board-draft-v1:user:g")).toContain("우리의 기억");
    await act(()=>result.current.reload());
    expect(result.current.board.version).toBe(2);expect(result.current.board.items).toHaveLength(0);
    act(()=>result.current.undo());
    expect(result.current.board.items).toHaveLength(1);expect(result.current.board.version).toBe(2);
  });
  it("uses the same request ID when retrying an unchanged failed save",async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({board:{background:"pegboard",items:[],version:0}})))
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response(JSON.stringify({board:{background:"pegboard",items:[item],version:1}})));
    vi.stubGlobal("fetch",fetch);
    const {result}=renderHook(()=>useMemoryBoard("g","user",false));
    await waitFor(()=>expect(result.current.loading).toBe(false));
    act(()=>result.current.change({background:"pegboard",items:[item]}));
    await act(()=>result.current.save());await act(()=>result.current.save());
    expect(JSON.parse(fetch.mock.calls[1][1].body).requestId).toBe(JSON.parse(fetch.mock.calls[2][1].body).requestId);
    expect(result.current.dirty).toBe(false);
  });
});
