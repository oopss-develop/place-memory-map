import { expect, test } from "@playwright/test";
const groupId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const record={id:"memory-photo",groupId,place:{id:"place",provider:"manual",name:"함께한 산책",address:"서울",category:"산책",latitude:37.54,longitude:127.04},visitedOn:"2026-10-01",isPlanned:false,title:"가을 산책",note:"함께 걸었어요",rating:5,tags:[],participants:[],photoIds:["photo-one"],photoUrls:["/app-icon-512.png"],markerStyle:"black-9",version:1,updatedBy:"나"};
test.beforeEach(async({page})=>{
  await page.addInitScript(record=>{localStorage.setItem("place-memory-visits-v2",JSON.stringify([record]));localStorage.setItem("place-memory-install-prompt-dismissed-v1","true");},record);
});
async function open(page:import("@playwright/test").Page){
  await page.goto("/");
  await page.getByRole("button",{name:"추억 보드",exact:true}).filter({visible:true}).click();
  await expect(page.getByRole("heading",{name:"추억 보드",exact:true})).toBeVisible();
  await expect(page.locator(".board-status")).not.toContainText("불러오는 중");
}
test("photo and note placement, editing, undo, save and reload",async({page})=>{
  await open(page);
  await page.getByRole("button",{name:"사진 붙이기",exact:true}).click();
  await page.locator(".board-photo-options button").first().click();
  await expect(page.locator('[data-kind="photo"]')).toHaveCount(1);
  await page.getByLabel("각도",{exact:true}).fill("17");
  await page.getByLabel("너비",{exact:true}).fill("300");
  await expect(page.locator('[data-kind="photo"]')).toHaveCSS("width","300px");
  await page.getByRole("button",{name:"포스트잇",exact:true}).click();
  await page.getByLabel("포스트잇 내용",{exact:true}).fill("함께해서 더 좋았던 하루");
  await page.getByRole("button",{name:"분홍 메모",exact:true}).click();
  await page.getByLabel("가로 위치",{exact:true}).fill("530");
  await page.getByLabel("세로 위치",{exact:true}).fill("210");
  await page.getByRole("button",{name:"보드 저장",exact:true}).click();
  await expect(page.getByRole("button",{name:"저장됨",exact:true})).toBeVisible();
  await page.reload();
  await page.getByRole("button",{name:"추억 보드",exact:true}).filter({visible:true}).click();
  await expect(page.locator('[data-board-id]')).toHaveCount(2);
  await page.locator('[data-kind="note"]').click();
  await expect(page.getByLabel("포스트잇 내용",{exact:true})).toHaveValue("함께해서 더 좋았던 하루");
  await page.screenshot({path:test.info().outputPath("memory-board-selected.png"),fullPage:true});
  await page.getByRole("button",{name:"보드에서 떼기",exact:true}).click();
  await expect(page.locator('[data-board-id]')).toHaveCount(1);
  await page.getByRole("button",{name:"되돌리기",exact:true}).click();
  await expect(page.locator('[data-board-id]')).toHaveCount(2);
  await page.getByRole("button",{name:"보드 저장",exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath("memory-board.png"),fullPage:true});
});
test("unsaved arrangements survive leaving the board and keyboard editing works",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await open(page);
  await page.getByRole("button",{name:"포스트잇",exact:true}).click();
  await page.getByLabel("포스트잇 내용",{exact:true}).fill("다음에 또 와요");
  await page.getByRole("button",{name:"기록으로",exact:true}).click();
  await page.getByRole("button",{name:"추억 보드",exact:true}).filter({visible:true}).click();
  await expect(page.locator('[data-kind="note"]')).toHaveCount(1);
  const note=page.locator('[data-kind="note"]');
  await note.focus(); await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("가로 위치",{exact:true})).toHaveValue("112");
  await page.keyboard.press("Delete");
  await expect(note).toHaveCount(0);
  await page.getByRole("button",{name:"되돌리기",exact:true}).click();
  await expect(note).toHaveCount(1);
});
test("desktop drag and rotation controls use actual pointer gestures",async({page},info)=>{
  test.skip(info.project.name!=="desktop","mouse editing");
  await open(page); await page.getByRole("button",{name:"포스트잇",exact:true}).click();
  const note=page.locator('[data-kind="note"]'); const bounds=await note.boundingBox();
  await page.mouse.move(bounds!.x+bounds!.width/2,bounds!.y+bounds!.height/2);
  await page.mouse.down(); await page.mouse.move(bounds!.x+bounds!.width/2+65,bounds!.y+bounds!.height/2+30,{steps:10});await page.mouse.up();
  expect(Number(await page.getByLabel("가로 위치",{exact:true}).inputValue())).toBeGreaterThan(130);
  const rotation=page.locator(".moveable-rotation-control");
  await expect(rotation).toBeVisible();
  const r=await rotation.boundingBox();
  await page.mouse.move(r!.x+r!.width/2,r!.y+r!.height/2);await page.mouse.down();
  await page.mouse.move(r!.x+r!.width/2+55,r!.y+r!.height/2+25,{steps:12});await page.mouse.up();
  expect(Number(await page.getByLabel("각도",{exact:true}).inputValue())).not.toBe(-5);
  const corner=await page.locator(".moveable-control.moveable-se").boundingBox();
  await page.mouse.move(corner!.x+corner!.width/2,corner!.y+corner!.height/2);await page.mouse.down();
  await page.mouse.move(corner!.x+corner!.width/2+35,corner!.y+corner!.height/2+35,{steps:12});await page.mouse.up();
  expect(Number(await page.getByLabel("너비",{exact:true}).inputValue())).toBeGreaterThan(230);
  await page.getByRole("button",{name:"보드 저장",exact:true}).click();
});


test("paper surface responds to hover and stays still with reduced motion",async({page},info)=>{
  test.skip(info.project.name!=="desktop","mouse hover");
  await open(page);await page.getByRole("button",{name:"사진 붙이기",exact:true}).click();
  await page.locator(".board-photo-options button").first().click();
  await expect(page.locator(".board-item-enhanced")).toHaveCount(1);
  await page.mouse.move(5,5);
  await page.evaluate(()=>new Promise<void>(resolve=>{let i=0;function tick(){if(++i>=45)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);}));
  const canvas=page.locator(".board-webgl canvas");const before=await canvas.screenshot();
  const bounds=await page.locator('[data-kind="photo"]').boundingBox();
  await page.mouse.move(bounds!.x+bounds!.width*0.8,bounds!.y+bounds!.height*0.8);
  await page.evaluate(()=>new Promise<void>(resolve=>{let i=0;function tick(){if(++i>=20)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);}));
  const after=await canvas.screenshot();expect(before.equals(after)).toBe(false);
  await page.emulateMedia({reducedMotion:"reduce"});await page.mouse.move(5,5);
  const still=await canvas.screenshot();await page.mouse.move(bounds!.x+bounds!.width*0.8,bounds!.y+bounds!.height*0.8);
  const stillAfter=await canvas.screenshot();expect(still.equals(stillAfter)).toBe(true);
});

test("mobile finger drag changes the note position",async({page},info)=>{
  test.skip(info.project.name!=="mobile","touch editing");
  await open(page);await page.getByRole("button",{name:"포스트잇",exact:true}).click();
  const b=await page.locator('[data-kind="note"]').boundingBox();const x=b!.x+b!.width/2,y=b!.y+b!.height/2;
  const session=await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
  for(let i=1;i<=6;i++)await session.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+i*5,y:y+i*3}]});
  await session.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  expect(Number(await page.getByLabel("가로 위치",{exact:true}).inputValue())).toBeGreaterThan(130);
  await session.detach();
});
test("empty board keeps its first actions readable at every viewport",async({page})=>{
  await open(page);
  const button=page.getByRole("button",{name:"첫 사진 붙이기",exact:true});
  await expect(button).toBeVisible(); const bounds=await button.boundingBox();expect(bounds!.height).toBeGreaterThanOrEqual(43);
  await page.screenshot({path:test.info().outputPath("memory-board-empty.png"),fullPage:true});
});
test("paper attachments follow layer order when overlapping",async({page},info)=>{
  test.skip(info.project.name!=="desktop","overlap render evidence");await page.emulateMedia({reducedMotion:"reduce"});
  await page.addInitScript(groupId=>localStorage.setItem("uttumak-board-v1:"+groupId,JSON.stringify({background:"pegboard",version:1,items:[
    {id:"11111111-1111-4111-8111-111111111111",kind:"note",x:200,y:200,width:230,height:210,rotation:0,text:"테이프도 함께 가려져요",color:"rose",attachment:"tape"},
    {id:"22222222-2222-4222-8222-222222222222",kind:"photo",x:170,y:155,width:320,height:360,rotation:0,text:"앞에 붙인 사진",color:"cream",attachment:"tape",visitId:"memory-photo",photoId:"photo-one"},
  ]})),groupId);
  await open(page);await expect(page.locator(".board-item-enhanced")).toHaveCount(2);
  await expect(page.locator('[data-kind="note"] .board-attachment')).toHaveCSS("opacity","0");
  const canvas=page.locator(".board-webgl canvas");const frontPhoto=await canvas.screenshot();
  await page.screenshot({path:test.info().outputPath("board-overlap-photo-front.png"),fullPage:true});
  await page.locator('[data-kind="photo"]').click();await page.getByRole("button",{name:"맨 뒤로",exact:true}).click();
  const frontNote=await canvas.screenshot();expect(frontPhoto.equals(frontNote)).toBe(false);
  await page.screenshot({path:test.info().outputPath("board-overlap-note-front.png"),fullPage:true});
  await page.locator('[data-kind="note"]').click();
  await page.getByLabel("붙이는 방법",{exact:true}).selectOption("pin");
  await page.screenshot({path:test.info().outputPath("board-pin-front.png"),fullPage:true});
});
test("a full board renders and stops accepting more items",async({page})=>{
  await page.addInitScript(groupId=>localStorage.setItem("uttumak-board-v1:"+groupId,JSON.stringify({background:"pegboard",version:1,items:Array.from({length:80},(_,i)=>({
    id:crypto.randomUUID(),kind:"note",x:24+(i%8)*145,y:15+Math.floor(i/8)*72,width:120,height:100,rotation:0,text:`추억 ${i+1}`,color:"cream",attachment:"tape",
  }))})),groupId);
  await open(page);await expect(page.locator('[data-board-id]')).toHaveCount(80);
  await expect(page.locator(".board-item-enhanced")).toHaveCount(80);
  await expect(page.getByRole("button",{name:"사진 붙이기",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"포스트잇",exact:true})).toBeDisabled();
});
