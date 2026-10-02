import { expect, test } from "@playwright/test";
const groupId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const photo="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='500'%3E%3Crect width='800' height='500' fill='%23737d86'/%3E%3C/svg%3E";
const record={id:"60000000-0000-4000-8000-000000000001",groupId,place:{id:"30000000-0000-4000-8000-000000000001",provider:"manual",name:"서울 숲",address:"서울 성동구",category:"산책",latitude:37.54,longitude:127.04},visitedOn:"2026-10-01",isPlanned:false,title:"친구와 산책",note:"피크닉을 했어요",rating:5,tags:["산책"],participants:[],photoUrls:[photo,photo],photoIds:["p1","p2"],markerStyle:"black-9",version:1,updatedBy:"나"};
test.beforeEach(async({page})=>{await page.addInitScript(row=>{if(!localStorage.getItem("place-memory-visits-v2"))localStorage.setItem("place-memory-visits-v2",JSON.stringify([row]));localStorage.setItem("place-memory-install-prompt-dismissed-v1","true");},record);await page.goto("/");});
async function openList(page:import("@playwright/test").Page){if((page.viewportSize()?.width??1000)<=820)await page.getByRole("button",{name:"기록 목록 열기"}).click();}
async function openRecord(page:import("@playwright/test").Page){await openList(page);await page.locator(".date-group-toggle").click();await page.locator(".record-item").click();}
test("photo enlargement, keyboard navigation and individual deletion",async({page},info)=>{
  await openRecord(page);await page.getByRole("button",{name:"사진 크게 보기",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"사진 크게 보기"});await expect(dialog).toBeVisible();await expect(dialog.locator("img")).toHaveAttribute("src",photo);
  await dialog.press("ArrowRight");await expect(dialog.locator("strong")).toContainText("2/2");
  await page.screenshot({path:info.outputPath("photo-enlargement.png")});
  await dialog.getByRole("button",{name:"사진 삭제",exact:true}).click();
  await page.getByRole("dialog",{name:"삭제 확인"}).getByRole("button",{name:"삭제",exact:true}).click();
  await expect(dialog.locator("strong")).toContainText("1/1");
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("place-memory-visits-v2")!)[0].photoUrls.length)).toBe(1);
  await page.getByRole("button",{name:"사진 보기 닫기"}).click();await expect(dialog).not.toBeVisible();
});
test("trash restores the deleted record and photos after a reload",async({page})=>{
  await openRecord(page);await page.getByRole("button",{name:"삭제",exact:true}).click();await page.getByRole("dialog",{name:"삭제 확인"}).getByRole("button",{name:"삭제",exact:true}).click();
  await expect(page.getByRole("button",{name:"실행 취소"})).toBeVisible();await page.reload();await openList(page);
  await page.getByRole("button",{name:"그룹 메뉴"}).click();await page.getByRole("button",{name:"휴지통",exact:true}).click();
  const trash=page.getByRole("dialog",{name:"휴지통"});await expect(trash).toContainText("서울 숲");await trash.getByRole("button",{name:"복원",exact:true}).click();await trash.getByRole("button",{name:"닫기",exact:true}).click();
  await expect(page.locator(".date-group-toggle")).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("place-memory-visits-v2")!)[0].photoUrls.length)).toBe(2);
});
test("record search keeps empty conditions and matches list and map",async({page},info)=>{
  await openList(page);await page.getByRole("radio",{name:"저장된 기록",exact:true}).click();await page.getByLabel("저장된 기록 검색").fill("피크닉");
  await expect(page.locator(".record-item")).toHaveCount(1);await expect(page.locator('.map-canvas [data-visit-id]')).toHaveCount(1);
  await page.getByRole("button",{name:"상세 필터"}).click();await page.getByLabel("시작일",{exact:true}).fill("2026-10-02");
  await expect(page.locator(".record-item")).toHaveCount(0);await expect(page.locator('.map-canvas [data-visit-id]')).toHaveCount(0);await expect(page.getByLabel("저장된 기록 검색")).toHaveValue("피크닉");
  await page.screenshot({path:info.outputPath("search-filters.png")});
  await page.reload();await openList(page);await expect(page.getByLabel("저장된 기록 검색")).toHaveValue("피크닉");
  await page.getByRole("button",{name:"상세 필터"}).click();await page.getByRole("button",{name:"필터 초기화"}).click();await expect(page.locator(".record-item")).toHaveCount(1);
});
test("visit drafts restore text after reload without creating a record",async({page})=>{
  await page.getByRole("button",{name:"지도에 핀 추가"}).click();await page.locator(".map-canvas").click({position:{x:220,y:180},force:true});
  await page.getByLabel("장소 이름",{exact:true}).fill("초안 장소");await page.getByLabel("기록 제목",{exact:true}).fill("아직 작성 중");await page.getByLabel("무엇을 했나요?").fill("잃어버리지 않을 메모");
  await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith("place-memory-draft-v1:")))).toBe(true);
  await page.reload();await openList(page);await page.getByRole("button",{name:"계속 작성",exact:true}).click();
  await expect(page.getByLabel("기록 제목",{exact:true})).toHaveValue("아직 작성 중");await expect(page.getByLabel("무엇을 했나요?")).toHaveValue("잃어버리지 않을 메모");
  await page.getByRole("button",{name:"취소",exact:true}).click();await openList(page);await page.getByRole("button",{name:"초안 삭제",exact:true}).click();await expect(page.getByRole("button",{name:"계속 작성",exact:true})).toHaveCount(0);
});
