// @vitest-environment node
import { beforeEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn(),upload:vi.fn(),sign:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/access-workspace",()=>({getAccessWorkspaceUser:mocks.auth}));
import { POST } from "./route";
const groupId="10000000-0000-4000-8000-000000000001",photoId="20000000-0000-4000-8000-000000000001";
const photo={id:photoId,storage_path:`${groupId}/board/${photoId}.webp`,upload_state:"pending",file_name:"사진.png",created_at:"2026-10-13T00:00:00Z"};
function request(bytes:Uint8Array|Buffer=Buffer.from("RIFF0000WEBPdata"),type="image/webp") {
  const form=new FormData();form.set("groupId",groupId);form.set("photoId",photoId);form.set("name","사진.png");form.set("photo",new File([new Uint8Array(bytes)],"compressed.webp",{type}));
  return new Request("http://localhost/api/memory-board/photos",{method:"POST",body:form});
}
beforeEach(()=>{
  vi.clearAllMocks();mocks.auth.mockResolvedValue({userId:"u",supabase:{rpc:mocks.rpc,storage:{from:()=>({upload:mocks.upload,createSignedUrl:mocks.sign})}}});
  mocks.rpc.mockImplementation(async name=>({data:name==="reserve_memory_board_photo"?photo:null,error:null}));
  mocks.upload.mockResolvedValue({error:null});mocks.sign.mockResolvedValue({data:{signedUrl:"https://example.test/photo.webp"},error:null});
});
describe("external board photo upload",()=>{
  it("uploads one immutable compressed file and returns a board-only reference",async()=>{
    const response=await POST(request());expect(response.status).toBe(200);expect((await response.json()).photo.uploadId).toBe(photoId);
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_memory_board_photo",expect.objectContaining({photo_bytes:16,photo_hash:expect.stringMatching(/^[a-f0-9]{64}$/)}));
    expect(mocks.upload).toHaveBeenCalledWith(photo.storage_path,expect.any(Buffer),{contentType:"image/webp",upsert:false});
    expect(mocks.rpc).toHaveBeenCalledWith("complete_memory_board_photo",{target_photo:photoId});
  });
  it("reuses completed content without uploading it again",async()=>{
    mocks.rpc.mockResolvedValue({data:{...photo,upload_state:"complete"},error:null});expect((await POST(request())).status).toBe(200);expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("accepts a stored retry but preserves pending metadata on network failure",async()=>{
    mocks.upload.mockResolvedValueOnce({error:{statusCode:"503"}}).mockResolvedValueOnce({error:{statusCode:"409"}});
    expect((await POST(request())).status).toBe(400);expect(mocks.rpc.mock.calls.filter(call=>call[0]==="complete_memory_board_photo")).toHaveLength(0);
    expect((await POST(request())).status).toBe(200);
  });
  it("rejects anonymous, unauthorized, oversized and mislabeled files",async()=>{
    mocks.auth.mockResolvedValueOnce(null);expect((await POST(request())).status).toBe(401);
    expect((await POST(request(Buffer.alloc(350001)))).status).toBe(400);
    expect((await POST(request(Buffer.from("not a webp image")))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({data:null,error:{code:"42501",message:"접근 권한 없음"}});expect((await POST(request())).status).toBe(403);expect(mocks.upload).not.toHaveBeenCalled();
  });
});
