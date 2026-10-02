// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/access-workspace",()=>({getAccessWorkspaceUser:mocks.auth}));
import { POST,PUT } from "./route";
import { POST as restore } from "./restore/route";
const id="10000000-0000-4000-8000-000000000001";
const body={groupId:id,place:{provider:"manual",name:"장소",latitude:37,longitude:127},visitedOn:"2026-10-01",title:"기록",rating:5,tags:[],participantIds:[],requestId:id};
const request=(data:unknown)=>new Request("http://localhost/api/visits",{method:"POST",body:JSON.stringify(data)});
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({userId:"u",supabase:{rpc:mocks.rpc}});mocks.rpc.mockResolvedValue({data:{id,version:1},error:null});});
it("passes an unchanged idempotency key on repeated create requests",async()=>{
  expect((await POST(request(body))).status).toBe(201);expect((await POST(request(body))).status).toBe(201);
  expect(mocks.rpc.mock.calls.every(call=>call[1].request_id===id && call[0]==="save_visit")).toBe(true);
});
it("returns conflicts and permission failures without pretending the save succeeded",async()=>{
  mocks.rpc.mockResolvedValueOnce({error:{code:"40001",message:"최신 버전 확인"}}).mockResolvedValueOnce({error:{code:"42501",message:"권한 없음"}});
  expect((await PUT(request({...body,id,version:1}))).status).toBe(409);expect((await POST(request(body))).status).toBe(403);
});
it("checks restore version and refuses expired or inaccessible records",async()=>{
  mocks.rpc.mockResolvedValueOnce({error:{code:"42501",message:"권한 없음"}}).mockResolvedValueOnce({error:{code:"P0002",message:"복원 기간 만료"}});
  expect((await restore(request({id,version:2}))).status).toBe(403);expect((await restore(request({id,version:2}))).status).toBe(410);
  expect(mocks.rpc).toHaveBeenCalledWith("restore_visit",{target_id:id,expected_version:2});
});
