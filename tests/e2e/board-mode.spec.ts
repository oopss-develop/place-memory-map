import { expect, test } from "@playwright/test";
const groupId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
test("view mode blocks mouse, touch and keyboard changes; edit mode preserves changes when switching",async({page},info)=>{
  await page.addInitScript(groupId=>{
    if(!localStorage.getItem("uttumak-board-v1:"+groupId))localStorage.setItem("uttumak-board-v1:"+groupId,JSON.stringify({background:"pegboard",version:1,items:[{id:"11111111-1111-4111-8111-111111111111",kind:"note",x:350,y:200,width:230,height:210,rotation:0,text:"그대로 보는 추억",color:"cream",attachment:"tape"}]}));
  },groupId);
  await page.goto("/");await page.getByRole("button",{name:"추억 보드",exact:true}).filter({visible:true}).click();
  await expect(page.locator(".board-status")).not.toContainText("불러오는 중");
  const note=page.locator('[data-kind="note"]');
  await expect(page.getByRole("button",{name:"수정 모드",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"포스트잇",exact:true})).toHaveCount(0);
  const original=await note.getAttribute("style");const b=await note.boundingBox();const x=b!.x+b!.width/2,y=b!.y+b!.height/2;
  if(info.project.name==="mobile"){
    await expect(note).toHaveCSS("touch-action","pan-x pan-y");
    const session=await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
    for(let i=1;i<=6;i++)await session.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+i*5,y:y+i*3}]});
    await session.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await session.detach();
  }else{
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+55,y+30,{steps:8});await page.mouse.up();
  }
  await note.focus();await page.keyboard.press("ArrowRight");await page.keyboard.press("Delete");await page.keyboard.press("Control+z");
  await expect(note).toHaveAttribute("style",original!);
  await expect(page.locator(".moveable-control-box")).toHaveCount(0);await expect(page.locator(".board-properties")).toHaveCount(0);
  await page.screenshot({path:test.info().outputPath("board-view-mode.png"),fullPage:true});
  await page.getByRole("button",{name:"수정 모드",exact:true}).click();await note.click();
  await page.getByLabel("각도",{exact:true}).fill("17");await page.getByLabel("포스트잇 내용",{exact:true}).fill("수정한 추억");
  await expect(page.locator(".moveable-control-box")).toBeVisible();
  await page.getByRole("button",{name:"뷰 모드",exact:true}).click();
  await expect(page.locator(".moveable-control-box")).toHaveCount(0);await expect(page.locator(".board-properties")).toHaveCount(0);
  await note.focus();await page.keyboard.press("Delete");await page.keyboard.press("Control+z");
  await expect(note).toHaveCount(1);await expect(note).toHaveAttribute("aria-label","포스트잇: 수정한 추억");
  await page.getByRole("button",{name:"수정 모드",exact:true}).click();await note.click();
  await expect(page.getByLabel("각도",{exact:true})).toHaveValue("17");
  await page.screenshot({path:test.info().outputPath("board-edit-mode.png"),fullPage:true});
  await page.getByRole("button",{name:"보드 저장",exact:true}).click();await expect(page.getByRole("button",{name:"저장됨",exact:true})).toBeVisible();await page.reload();
  await page.getByRole("button",{name:"추억 보드",exact:true}).filter({visible:true}).click();
  await expect(page.getByRole("button",{name:"수정 모드",exact:true})).toBeVisible();await expect(note).toHaveAttribute("aria-label","포스트잇: 수정한 추억");
});
