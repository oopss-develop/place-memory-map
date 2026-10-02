import { expect,test } from "@playwright/test";
const groupId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
test("searchable selectors work by keyboard and long names remain usable in dark mode at enlarged layout",async({page},info)=>{
  await page.setViewportSize({width:640,height:400}); // A 1280×800 desktop at 200% browser zoom.
  await page.addInitScript(groupId=>{
    localStorage.setItem("place-memory-install-prompt-dismissed-v1","true");localStorage.setItem("place-memory-theme-v1","dark");localStorage.setItem("place-memory-font-v1","gowun");
    localStorage.setItem("place-memory-groups-v1",JSON.stringify([{id:groupId,name:"서울에서 함께 남긴 긴 이름의 가을 장소 기록과 여행 계획",role:"owner",memberCount:4},{id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",name:"제주 여행",role:"owner",memberCount:4}]));
    localStorage.setItem("place-memory-visits-v2",JSON.stringify([{id:"60000000-0000-4000-8000-000000000001",groupId,place:{id:"30000000-0000-4000-8000-000000000001",provider:"manual",name:"서울 숲에서 친구들과 함께 산책한 긴 이름의 장소",address:"서울 성동구",category:"산책",latitude:37.54,longitude:127.04},visitedOn:"2026-10-01",title:"함께한 기록",note:"",isPlanned:false,rating:5,tags:[],participants:[],photoUrls:[],markerStyle:"black-9",version:1,updatedBy:"나"}]));
  },groupId);
  await page.goto("/");await page.getByRole("button",{name:"기록 목록 열기"}).click();
  const picker=page.getByRole("button",{name:"함께 보는 지도 선택",exact:true});await picker.press("Enter");
  const search=page.getByLabel("함께 보는 지도 선택 검색",{exact:true});await search.fill("서울");await search.press("ArrowDown");await page.keyboard.press("Enter");await expect(picker).toBeFocused();
  await page.getByRole("radio",{name:"저장된 기록",exact:true}).click();await page.getByRole("button",{name:"상세 필터"}).click();
  await page.getByRole("button",{name:"기록 정렬",exact:true}).click();await page.getByRole("menuitemradio",{name:"평점 높은 순",exact:true}).click();
  await expect(page.locator(".record-item")).toHaveCount(1);await expect(page.locator(".journal-app")).toHaveAttribute("data-theme","dark");await expect(page.locator("html")).toHaveAttribute("data-font","gowun");
  await page.getByRole("button",{name:"필터 초기화"}).scrollIntoViewIfNeeded();await expect(page.getByRole("button",{name:"필터 초기화"})).toBeInViewport();
  await expect(page.getByRole("button",{name:"그룹 메뉴"})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(640);
  await page.screenshot({path:info.outputPath("dark-enlarged-layout.png")});
  await page.setViewportSize({width:960,height:720});await expect(page.locator(".journal-sidebar")).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(960);
});
