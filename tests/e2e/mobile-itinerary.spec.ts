import { expect,test } from "@playwright/test";
const groupId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const trip={id:"10000000-0000-4000-8000-000000000001",groupId,name:"서울 여행",startDate:"2026-10-01",endDate:"2026-10-03",timeZone:"Asia/Seoul",version:1};
const place={id:"20000000-0000-4000-8000-000000000001",provider:"manual",name:"서울 숲",address:"서울 성동구",category:"산책",latitude:37.54,longitude:127.04};
const item={id:"30000000-0000-4000-8000-000000000001",groupId,tripId:trip.id,place,startsAt:"2026-10-01T23:00",endsAt:"2026-10-02T01:00",title:"야경 산책",note:"물과 간식을 준비하세요.",markerStyle:"black-9",version:1};
test.beforeEach(async({page},info)=>{test.skip(info.project.name!=="mobile","mobile day-list workflow");await page.addInitScript(({groupId,trip,item})=>{localStorage.setItem("place-memory-install-prompt-dismissed-v1","true");localStorage.setItem("place-memory-trips-v1:"+groupId,JSON.stringify({trips:[trip],items:[item,{...item,id:"30000000-0000-4000-8000-000000000002",title:"겹치는 일정",startsAt:"2026-10-01T23:30"}]}));},{groupId,trip,item});await page.goto("/");await page.getByRole("button",{name:"여행 계획",exact:true}).filter({visible:true}).click();});
test("mobile defaults to a day list with overnight and overlap warnings and remembers view",async({page},info)=>{
  const list=page.getByRole("region",{name:"일별 일정 목록"});await expect(list).toBeVisible();await expect(list).toContainText("다음 날 종료");await expect(list).toContainText("시간 중복");
  await page.screenshot({path:info.outputPath("mobile-itinerary.png")});
  await list.getByRole("button",{name:"일정 수정",exact:true}).first().click();await expect(page.getByRole("dialog",{name:"일정 편집"})).toBeVisible();await page.getByLabel("메모",{exact:true}).fill("버튼으로 수정한 메모");await page.getByRole("button",{name:"일정 저장",exact:true}).click();await expect(list).toContainText("버튼으로 수정한 메모");
  await list.getByRole("button",{name:"지도 보기",exact:true}).first().click();await expect(page.locator(".planner-map-panel")).toBeVisible();
  await page.reload();await page.getByRole("button",{name:"여행 계획",exact:true}).filter({visible:true}).click();await expect(page.getByRole("radio",{name:"지도",exact:true})).toBeChecked();
});
test("schedule draft survives a reload and keeps its local clock",async({page})=>{
  await page.getByRole("button",{name:"일정 추가",exact:true}).click();await page.getByLabel("일정 시작",{exact:true}).fill("2026-10-01T10:30");await page.getByLabel("메모",{exact:true}).fill("작성 중인 일정 메모");
  await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith("place-memory-draft-v1:")&&key.includes(":schedule:")))).toBe(true);
  await page.reload();await page.getByRole("button",{name:"여행 계획",exact:true}).filter({visible:true}).click();await page.getByRole("button",{name:"여행 탐색 열기"}).click();await page.getByRole("button",{name:"계속 작성",exact:true}).click();
  await expect(page.getByLabel("일정 시작",{exact:true})).toHaveValue("2026-10-01T10:30");await expect(page.getByLabel("메모",{exact:true})).toHaveValue("작성 중인 일정 메모");
});
