import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { KakaoMap } from "./kakao-map";
import type { DashboardData } from "@/lib/data";
const mocks=vi.hoisted(()=>({refresh:vi.fn(),fetch:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh,replace:vi.fn()})}));
vi.mock("@/components/kakao-map",()=>({KakaoMap:(props:ComponentProps<typeof KakaoMap>)=><><button onClick={()=>props.onManualPoint?.(37,127)}>테스트 장소 선택</button>{props.visits[0] && <button onClick={()=>props.onSelect(props.visits[0])}>테스트 기록 선택</button>}</>}));
vi.mock("@/components/install-app-button",()=>({InstallAppButton:()=>null}));
vi.mock("@/lib/images",()=>({prepareVisitImage:async(file:File)=>file}));
import { MapJournal } from "./map-journal";
const id="10000000-0000-4000-8000-000000000001";
const savedVisit = { id, groupId: id, place: { id, provider: "manual" as const, name: "서울 숲", address: "", category: "", latitude: 37, longitude: 127 }, visitedOn: "2026-10-07", isPlanned: false, title: "산책", note: "메모", rating: 5, tags: [], participants: [], photoUrls: [], markerStyle: "black-9" as const, version: 1, updatedBy: "나" };
beforeEach(()=>{
  vi.clearAllMocks();localStorage.clear();sessionStorage.clear();
  vi.stubGlobal("fetch",mocks.fetch);
  vi.stubGlobal("ResizeObserver",class{observe(){} disconnect(){}});
  Object.defineProperty(window,"matchMedia",{configurable:true,value:()=>({matches:false,addEventListener(){},removeEventListener(){}})});
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");this.dispatchEvent(new Event("close"));};
  // jsdom's native FormData does not see the testing-library FileList override.
  const NativeFormData=window.FormData;
  vi.stubGlobal("FormData",class extends NativeFormData{
    constructor(form?:HTMLFormElement){super(form);const input=form?.querySelector<HTMLInputElement>('input[name="photos"]');if(input?.files?.length){this.delete("photos");for(const file of Array.from(input.files))this.append("photos",file);}}
  });
});
it.each(["new", "planned", "edit"])("celebrates only a confirmed new completed visit (%s)", async kind => {
  let first = true;
  const requests: string[] = [];
  mocks.fetch.mockImplementation(async (url: string, options: RequestInit) => {
    if (url !== "/api/visits") return Response.json({ error: "unavailable" }, { status: 503 });
    requests.push(JSON.parse(String(options.body)).requestId);
    if (first) { first = false; throw new Error("response lost"); }
    return Response.json({ id, version: 2, placeId: id });
  });
  render(<MapJournal viewerId={id} initialData={{ demoMode: false, groups: [{ id, name: "지도", role: "owner", memberCount: 1 }], members: [{ id, displayName: "나", initials: "나" }], visits: kind === "edit" ? [savedVisit] : [] }} />);
  if (kind === "edit") { fireEvent.click(screen.getByText("테스트 기록 선택")); fireEvent.click(screen.getByRole("button", { name: "수정" })); }
  else { fireEvent.click(screen.getByText("테스트 장소 선택")); fireEvent.change(screen.getByLabelText("장소 이름"), { target: { value: "서울 숲" } }); fireEvent.change(screen.getByLabelText("기록 제목"), { target: { value: "산책" } }); }
  if (kind === "planned") fireEvent.click(document.querySelector<HTMLInputElement>('input[name="isPlanned"]')!);
  fireEvent.submit(document.querySelector(".visit-form")!);
  await waitFor(() => expect(screen.getByText(/연결하지 못했습니다/)).toBeInTheDocument());
  expect(screen.queryByText("오늘의 기억을 남겼어요")).not.toBeInTheDocument();
  fireEvent.submit(document.querySelector(".visit-form")!);
  await waitFor(() => expect(screen.getByText(kind === "new" ? "오늘의 기억을 남겼어요" : "기록을 저장했습니다.")).toBeInTheDocument());
  expect(requests).toHaveLength(2);
  expect(requests[0]).toBe(requests[1]);
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("does not reload or remount displayed photos when synchronization renews signed URLs", async () => {
  const now = Date.now();
  const signed = (seconds: number) => `https://example.test/photo.webp?token=h.${btoa(JSON.stringify({ exp: Math.floor(now / 1000) + seconds }))}.s`;
  const data: DashboardData = { demoMode: false, groups: [{ id, name: "공유 지도", role: "owner", memberCount: 1 }], members: [], visits: [{
    id, groupId: id, place: { id, provider: "manual", name: "사진 장소", address: "", category: "", latitude: 37, longitude: 127 },
    visitedOn: "2026-10-02", isPlanned: false, title: "기록", note: "", rating: 5, tags: [], participants: [], photoIds: ["photo-1"], photoUrls: [signed(3600)], markerStyle: "black-9", version: 1, updatedBy: "나",
  }] };
  const { rerender } = render(<MapJournal viewerId={id} initialData={data} />);
  fireEvent.click(screen.getByText("테스트 기록 선택"));
  const image = document.querySelector(".sheet-photo img")!;
  fireEvent.click(screen.getByRole("button", { name: "사진 크게 보기" }));
  const enlarged = document.querySelector(".lightbox-image-stage > img")!;
  for (let cycle = 1; cycle <= 3; cycle++) {
    rerender(<MapJournal viewerId={id} initialData={{ ...data, visits: [{ ...data.visits[0], title: `수정 ${cycle}`, version: cycle + 1, photoUrls: [signed(3600 + cycle * 10)] }] }} />);
    await waitFor(() => expect(screen.getByText(`수정 ${cycle}`)).toBeInTheDocument());
    expect(document.querySelector(".sheet-photo img")).toBe(image);
    expect(image).toHaveAttribute("src", data.visits[0].photoUrls[0]);
    expect(document.querySelector(".lightbox-image-stage > img")).toBe(enlarged);
    expect(enlarged).toHaveAttribute("src", data.visits[0].photoUrls[0]);
  }
  rerender(<MapJournal viewerId={id} initialData={{ ...data, visits: [{ ...data.visits[0], version: 5, photoIds: ["photo-2"], photoUrls: [signed(3700)] }] }} />);
  await waitFor(() => expect(document.querySelector(".sheet-photo img")).not.toBe(image));
  expect(document.querySelector(".sheet-photo img")).toHaveAttribute("src", signed(3700));
});
it("keeps the saved record and retries only failed photos with their original request IDs",async()=>{
  let failedId="";
  mocks.fetch.mockImplementation(async(url:string,options:RequestInit)=>{
    if(url==="/api/visits")return {ok:true,json:async()=>({id,version:1,placeId:id})};
    const form=options.body as FormData,ids=JSON.parse(String(form.get("photoIds"))) as string[];
    if(ids.length===2){failedId=ids[1];return {ok:true,json:async()=>({complete:false,results:[{fileId:ids[0],photoId:"first",url:"https://example.test/first.webp"},{fileId:ids[1],error:"upload failed"}]})};}
    return {ok:true,json:async()=>({complete:true,results:[{fileId:ids[0],photoId:"second",url:"https://example.test/second.webp"}]})};
  });
  render(<MapJournal viewerId={id} initialData={{demoMode:false,groups:[{id,name:"공유 지도",role:"owner",memberCount:1}],members:[{id,displayName:"나",initials:"나"}],visits:[]}}/>);
  fireEvent.click(screen.getByText("테스트 장소 선택"));fireEvent.change(screen.getByLabelText("장소 이름"),{target:{value:"서울 숲"}});fireEvent.change(screen.getByLabelText("기록 제목"),{target:{value:"산책"}});
  const input=document.querySelector<HTMLInputElement>('input[name="photos"]')!;
  fireEvent.change(input,{target:{files:[new File(["a"],"a.webp",{type:"image/webp"}),new File(["b"],"b.webp",{type:"image/webp"})]}});
  fireEvent.submit(document.querySelector(".visit-form")!);
  await waitFor(()=>expect(screen.getByRole("button",{name:"실패한 사진 1장 다시 올리기"})).toBeEnabled());
  expect(screen.getByText("기록은 저장되었습니다. 실패한 사진을 다시 올려주세요.")).toBeInTheDocument();
  expect(screen.queryByText("오늘의 기억을 남겼어요")).not.toBeInTheDocument();
  const draft=JSON.parse(localStorage.getItem(Object.keys(localStorage).find(key=>key.startsWith("place-memory-draft-v1:"))!)!);
  expect(draft.data.editing.id).toBe(id);expect(draft.data.fields.title).toEqual(["산책"]);expect(draft.data.photoRequests.map((photo:{id:string})=>photo.id)).toEqual([failedId]);
  fireEvent.click(screen.getByRole("button",{name:"실패한 사진 1장 다시 올리기"}));
  await waitFor(()=>expect(screen.getByText("오늘의 기억을 남겼어요")).toBeInTheDocument());
  expect(mocks.fetch.mock.calls.filter(call=>call[0]==="/api/visits")).toHaveLength(1);
  const retries=mocks.fetch.mock.calls.filter(call=>String(call[0]).endsWith("/photos"));expect(retries).toHaveLength(2);
  expect(JSON.parse(String((retries[1][1].body as FormData).get("photoIds")))).toEqual([failedId]);
  expect(Object.keys(localStorage).filter(key=>key.startsWith("place-memory-draft-v1:"))).toEqual([]);
});
