import { expect, test } from "@playwright/test";
for(const [width,height] of [[1440,900],[1280,720],[390,844]] as const) test(`board fits without scrolling at ${width}x${height}`,async({page},info)=>{
  test.skip(info.project.name!=="desktop","explicit viewport sizes");await page.setViewportSize({width,height});
  await page.goto("/");await page.getByRole("button",{name:"추억 보드",exact:true}).filter({visible:true}).click();
  await expect(page.locator(".board-status")).not.toContainText("불러오는 중");
  await page.getByRole("button",{name:"수정 모드",exact:true}).click();
  const viewport=page.locator(".board-viewport");
  const fits=()=>viewport.evaluate(el=>el.scrollWidth<=el.clientWidth+1 && el.scrollHeight<=el.clientHeight+1);
  await expect.poll(fits).toBe(true);
  await page.getByRole("button",{name:"포스트잇",exact:true}).click();
  await expect(page.getByLabel("포스트잇 내용",{exact:true})).toBeVisible();
  await expect.poll(fits).toBe(true);
  const bounds=await viewport.boundingBox();await page.mouse.move(bounds!.x+20,bounds!.y+20);await page.mouse.wheel(100,250);
  await expect.poll(()=>viewport.evaluate(el=>({x:el.scrollLeft,y:el.scrollTop}))).toEqual({x:0,y:0});
  await page.setViewportSize({width:Math.max(320,width-120),height:Math.max(540,height-100)});
  await expect.poll(fits).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
