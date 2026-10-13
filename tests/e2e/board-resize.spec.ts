import { expect, test } from "@playwright/test";
const groupId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
for (const corner of ["nw","ne","sw","se"] as const) test(`resize ${corner} stays proportional to pointer motion`,async({page},info)=>{
  test.skip(info.project.name!=="desktop","mouse resize regression");
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(groupId=>{
    const visit={id:"resize-visit",groupId,place:{id:"place",provider:"manual",name:"사진",address:"서울",category:"산책",latitude:37.54,longitude:127.04},visitedOn:"2026-10-01",isPlanned:false,title:"사진",note:"",rating:5,tags:[],participants:[],photoIds:["resize-photo"],photoUrls:["/app-icon-512.png"],markerStyle:"black-9",version:1,updatedBy:"나"};
    localStorage.setItem("place-memory-visits-v2",JSON.stringify([visit]));
    localStorage.setItem("uttumak-board-v1:"+groupId,JSON.stringify({background:"pegboard",version:1,items:[{id:"11111111-1111-4111-8111-111111111111",kind:"photo",x:350,y:200,width:250,height:290,rotation:17,text:"사진",color:"cream",attachment:"tape",visitId:"resize-visit",photoId:"resize-photo"}]}));
  },groupId);
  await page.goto("/");await page.getByRole("button",{name:"추억 보드",exact:true}).filter({visible:true}).click();
  await page.getByRole("button",{name:"수정 모드",exact:true}).click();
  const photo=page.locator('[data-kind="photo"]');await photo.click();
  await expect(photo).toHaveClass(/board-item-enhanced/);
  for(const zoomDirection of ["fit","out","in"]){
    if(zoomDirection==="out")for(let i=0;i<6;i++)await page.getByRole("button",{name:"보드 축소",exact:true}).click();
    if(zoomDirection==="in")for(let i=0;i<10;i++)await page.getByRole("button",{name:"보드 확대",exact:true}).click();
    await page.getByLabel("너비",{exact:true}).fill("250");await page.getByLabel("높이",{exact:true}).fill("290");
    await page.getByLabel("가로 위치",{exact:true}).fill("350");await page.getByLabel("세로 위치",{exact:true}).fill("200");
    const zoom=await page.locator(".board-stage").evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a);
    const handle=page.locator(`.moveable-control.moveable-${corner}`);await handle.scrollIntoViewIfNeeded();const b=await handle.boundingBox();
    const dx=corner.endsWith("e")?1:-1,dy=corner.startsWith("s")?1:-1;
    const a=17*Math.PI/180;
    const x=b!.x+b!.width/2,y=b!.y+b!.height/2;
    await page.mouse.move(x,y);await page.mouse.down();
    for(let step=1;step<=20;step++){
      const d=step*2;
      await page.mouse.move(x+zoom*(Math.cos(a)*dx*d-Math.sin(a)*dy*d),y+zoom*(Math.sin(a)*dx*d+Math.cos(a)*dy*d));
      await expect(photo).toHaveClass(/board-item-enhanced/);
      const actual=await photo.evaluate(el=>parseFloat(getComputedStyle(el).width));
      expect(actual,`${corner} ${zoomDirection} step ${step}`).toBeGreaterThanOrEqual(248);
      expect(actual,`${corner} ${zoomDirection} step ${step}`).toBeLessThanOrEqual(250+d+12);
    }
    const held=await photo.evaluate(el=>parseFloat(getComputedStyle(el).width));
    for(let repeat=0;repeat<3;repeat++){
      await page.mouse.move(x+zoom*(Math.cos(a)*dx*40-Math.sin(a)*dy*40),y+zoom*(Math.sin(a)*dx*40+Math.cos(a)*dy*40));
      expect(await photo.evaluate(el=>parseFloat(getComputedStyle(el).width))).toBeCloseTo(held,0);
    }
    if(corner==="se" && zoomDirection==="out") {
    await page.mouse.move(x+zoom*(Math.cos(a)*dx*500-Math.sin(a)*dy*500),y+zoom*(Math.sin(a)*dx*500+Math.cos(a)*dy*500),{steps:6});
    const limited=await photo.evaluate(el=>({width:parseFloat(getComputedStyle(el).width),height:parseFloat(getComputedStyle(el).height)}));
    expect(limited.width).toBeLessThanOrEqual(560);expect(limited.height).toBeLessThanOrEqual(600);
    expect(limited.width/limited.height).toBeCloseTo(250/290,2);
    await page.mouse.move(x+zoom*(Math.cos(a)*dx*40-Math.sin(a)*dy*40),y+zoom*(Math.sin(a)*dx*40+Math.cos(a)*dy*40),{steps:6});
    }
    await page.mouse.up();
    const finalWidth=await photo.evaluate(el=>parseFloat(getComputedStyle(el).width));
    expect(finalWidth,`${corner} ${zoomDirection} end`).toBeGreaterThan(275);
    expect(finalWidth,`${corner} ${zoomDirection} end`).toBeLessThan(310);
  }
});
