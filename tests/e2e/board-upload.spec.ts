import { expect, test } from "@playwright/test";
async function open(page:import("@playwright/test").Page) {
  await page.goto("/");await page.getByRole("button",{name:"추억 보드",exact:true}).filter({visible:true}).click();
  await expect(page.locator(".board-status")).not.toContainText("불러오는 중");
}
async function fixture(page:import("@playwright/test").Page) {
  return page.evaluate(()=>{
    const canvas=document.createElement("canvas");canvas.width=2000;canvas.height=1600;const ctx=canvas.getContext("2d")!;
    for(let y=0;y<1600;y+=20)for(let x=0;x<2000;x+=20){ctx.fillStyle=`rgb(${x%255},${y%255},${(x+y)%255})`;ctx.fillRect(x,y,20,20);}
    return canvas.toDataURL("image/png");
  });
}
test("external photo uses existing compression and survives reload",async({page})=>{
  await open(page);const data=await fixture(page);
  await page.getByLabel("외부 사진 파일 선택",{exact:true}).setInputFiles({name:"우리의 외부 사진.png",mimeType:"image/png",buffer:Buffer.from(data.split(",")[1],"base64")});
  await expect(page.locator("[data-upload-id]")).toHaveCount(1);
  await expect(page.locator(".board-status")).toContainText("1장의 사진을 붙였어요");
  const uploadId=await page.locator("[data-upload-id]").getAttribute("data-upload-id");
  const dimensions=await page.evaluate(id=>new Promise<{bytes:number;width:number;height:number;type:string}>((resolve,reject)=>{
    const request=indexedDB.open("uttumak-board-photos-v1");request.onsuccess=()=>{
      const db=request.result;const photo=db.transaction("photos").objectStore("photos").get(id!);
      photo.onsuccess=async()=>{const image=await createImageBitmap(photo.result.file);resolve({bytes:photo.result.file.size,type:photo.result.file.type,width:image.width,height:image.height});image.close();db.close();};photo.onerror=()=>reject(photo.error);
    };
  }),uploadId);
  expect(dimensions.bytes).toBeLessThanOrEqual(350000);expect(dimensions.type).toBe("image/webp");expect(Math.max(dimensions.width,dimensions.height)).toBeLessThanOrEqual(1280);
  await page.getByRole("button",{name:"보드 저장",exact:true}).click();await page.reload();await open(page);
  await expect(page.locator("[data-upload-id]")).toHaveCount(1);await expect(page.locator(".board-item-enhanced")).toHaveCount(1);
  await page.locator("[data-upload-id]").click();await page.getByLabel("각도",{exact:true}).fill("23");
  await page.screenshot({path:test.info().outputPath("board-upload-selected.png"),fullPage:true});
  await page.getByRole("button",{name:"보드에서 떼기",exact:true}).click();await expect(page.locator("[data-upload-id]")).toHaveCount(0);
  await page.getByRole("button",{name:"되돌리기",exact:true}).click();await expect(page.locator("[data-upload-id]")).toHaveCount(1);
});
test("drop and clipboard paste add external photos",async({page})=>{
  await open(page);const data=await fixture(page);
  const transfer=await page.evaluateHandle(async data=>{const blob=await(await fetch(data)).blob();const dt=new DataTransfer();dt.items.add(new File([blob],"끌어온 사진.png",{type:"image/png"}));return dt;},data);
  const viewport=page.locator(".board-viewport");await viewport.dispatchEvent("dragenter",{dataTransfer:transfer});await viewport.dispatchEvent("dragover",{dataTransfer:transfer});await viewport.dispatchEvent("drop",{dataTransfer:transfer,clientX:200,clientY:400});
  await expect(page.locator("[data-upload-id]")).toHaveCount(1);
  await expect(page.getByRole("button",{name:"사진 업로드",exact:true})).toBeEnabled();
  await page.evaluate(dt=>document.querySelector(".memory-board-app")!.dispatchEvent(new ClipboardEvent("paste",{clipboardData:dt,bubbles:true,cancelable:true})),transfer);
  await expect(page.locator("[data-upload-id]")).toHaveCount(2);await transfer.dispose();
});
test("bad files report an error without adding a broken photo",async({page})=>{
  await open(page);await page.getByLabel("외부 사진 파일 선택",{exact:true}).setInputFiles({name:"문서.pdf",mimeType:"application/pdf",buffer:Buffer.from("not an image")});
  await expect(page.locator(".board-error")).toContainText("사진 파일을 선택");await expect(page.locator("[data-upload-id]")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"사진 업로드",exact:true})).toBeEnabled();
});
