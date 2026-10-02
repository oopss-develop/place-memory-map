// @vitest-environment node
import { afterEach,beforeEach,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({create:vi.fn(),rpc:vi.fn(),from:vi.fn(),remove:vi.fn(),deleteRow:vi.fn()}));
vi.mock("@supabase/supabase-js",()=>({createClient:mocks.create}));
import { GET } from "./route";
beforeEach(()=>{
  vi.clearAllMocks();vi.stubEnv("CRON_SECRET","local-test-secret");vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","http://localhost:54321");vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","test-service-key");
  mocks.create.mockReturnValue({rpc:mocks.rpc,from:mocks.from,storage:{from:()=>({remove:mocks.remove})}});
  mocks.rpc.mockImplementation(async name=>({data:name==="claim_expired_visits"?[{id:"expired"}]:0,error:null}));
  mocks.remove.mockResolvedValue({error:null});mocks.deleteRow.mockResolvedValue({error:null});
  mocks.from.mockReturnValue({select:()=>({eq:async()=>({data:[{storage_path:"group/expired/photo.webp"}],error:null}),lt:()=>({limit:async()=>({data:[],error:null})})}),delete:()=>({eq:()=>({not:mocks.deleteRow})})});
});
afterEach(()=>vi.unstubAllEnvs());
const request=()=>new Request("http://localhost/api/maintenance/purge-visits",{headers:{authorization:"Bearer local-test-secret"}});
it("blocks unauthenticated maintenance without creating an admin client",async()=>{
  expect((await GET(new Request("http://localhost/api/maintenance/purge-visits"))).status).toBe(401);expect(mocks.create).not.toHaveBeenCalled();
});
it("preserves DB rows when Storage deletion fails so a later run can retry",async()=>{
  mocks.remove.mockResolvedValue({error:{message:"offline"}});
  const response=await GET(request());expect(response.status).toBe(503);expect((await response.json()).failed).toBe(1);expect(mocks.deleteRow).not.toHaveBeenCalled();
});
it("deletes metadata only after deleting the claimed record's files",async()=>{
  const response=await GET(request());expect(response.status).toBe(200);expect((await response.json()).purged).toBe(1);
  expect(mocks.remove).toHaveBeenCalledWith(["group/expired/photo.webp"]);expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteRow.mock.invocationCallOrder[0]);
});
