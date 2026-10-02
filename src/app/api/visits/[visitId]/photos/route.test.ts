// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn(),upload:vi.fn(),sign:vi.fn(),remove:vi.fn(),from:vi.fn()}));
vi.mock("@/lib/access-workspace",()=>({getAccessWorkspaceUser:mocks.auth}));
import { DELETE, POST } from "./route";
const visitId="10000000-0000-4000-8000-000000000001";
const ids=["20000000-0000-4000-8000-000000000001","20000000-0000-4000-8000-000000000002"];
const context={params:Promise.resolve({visitId})};
function request(fileIds=ids){ const form=new FormData();for(const id of fileIds)form.append("photos",new File(["webp"],id+".webp",{type:"image/webp"}));form.append("photoIds",JSON.stringify(fileIds));return new Request("http://localhost/photos",{method:"POST",body:form}); }
beforeEach(()=>{
  vi.clearAllMocks(); mocks.auth.mockResolvedValue({userId:"u",supabase:{rpc:mocks.rpc,from:mocks.from,storage:{from:()=>({upload:mocks.upload,createSignedUrl:mocks.sign,remove:mocks.remove})}}});
  mocks.rpc.mockImplementation(async (name,args)=>({data:name==="reserve_visit_photo"?{id:args.file_id,storage_path:args.file_id+".webp",upload_state:"pending"}:null,error:null}));
  mocks.upload.mockResolvedValue({error:null});mocks.sign.mockImplementation(async path=>({data:{signedUrl:"https://example.test/"+path},error:null}));
});
describe("photo retry API",()=>{
  it("reports each photo separately so one failure doesn't hide a successful save",async()=>{
    mocks.upload.mockResolvedValueOnce({error:null}).mockResolvedValueOnce({error:{statusCode:"500"}});
    const result=await (await POST(request(),context)).json();
    expect(result.complete).toBe(false);expect(result.results[0].url).toBeTruthy();expect(result.results[1].error).toContain("실패");
    expect(mocks.rpc.mock.calls.filter(call=>call[0]==="complete_visit_photo")).toHaveLength(1);
  });
  it("retries the same photo ID and accepts an already-uploaded immutable file",async()=>{
    mocks.upload.mockResolvedValue({error:{statusCode:"409"}});
    expect((await (await POST(request([ids[1]]),context)).json()).complete).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_visit_photo",expect.objectContaining({file_id:ids[1],file_hash:expect.stringMatching(/^[a-f0-9]{64}$/)}));
    expect(mocks.upload).toHaveBeenCalledWith(ids[1]+".webp",expect.any(Buffer),expect.objectContaining({upsert:false}));
  });
  it("does not upload a completed photo again",async()=>{
    mocks.rpc.mockResolvedValue({data:{id:ids[0],storage_path:"existing.webp",upload_state:"complete"},error:null});
    expect((await (await POST(request([ids[0]]),context)).json()).complete).toBe(true);expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("blocks anonymous uploads and missing group permission without touching storage",async()=>{
    mocks.auth.mockResolvedValueOnce(null);expect((await POST(request(),context)).status).toBe(401);
    mocks.rpc.mockResolvedValue({data:null,error:{code:"42501",message:"권한 없음"}});
    expect((await (await POST(request(),context)).json()).complete).toBe(false);expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rejects deletion of a photo in an inaccessible record",async()=>{
    mocks.from.mockReturnValue({select:()=>({eq:()=>({is:()=>({maybeSingle:async()=>({data:null})})})})});
    expect((await DELETE(new Request("http://localhost/photos",{method:"DELETE",body:JSON.stringify({photoId:ids[0]})}),context)).status).toBe(403);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
