import { describe, expect, it } from "vitest";
import { boardContentSchema, clampBoardItem, resolveBoardPhoto, type BoardItem } from "./memory-board";
import type { Visit } from "@/types/domain";
const item:BoardItem={id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",kind:"note",x:10,y:20,width:230,height:200,rotation:3,text:"기억",color:"cream",attachment:"tape"};
describe("memory board",()=>{
  it("accepts uploaded-photo references but rejects mixed or absent sources",()=>{
    const photo={...item,kind:"photo",uploadId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"};
    expect(boardContentSchema.safeParse({background:"pegboard",items:[photo]}).success).toBe(true);
    expect(boardContentSchema.safeParse({background:"pegboard",items:[{...photo,visitId:"v",photoId:"p"}]}).success).toBe(false);
    expect(resolveBoardPhoto(photo as BoardItem,[],[{uploadId:photo.uploadId,key:"upload",url:"signed",title:"사진",place:"직접 올린 사진",date:"2026-10-13"}])?.url).toBe("signed");
  });
  it("rejects duplicate items, invalid coordinates and missing photo references",()=>{
    expect(boardContentSchema.safeParse({background:"pegboard",items:[item,item]}).success).toBe(false);
    expect(boardContentSchema.safeParse({background:"pegboard",items:[{...item,x:1199}]}).success).toBe(false);
    expect(boardContentSchema.safeParse({background:"pegboard",items:[{...item,width:NaN}]}).success).toBe(false);
    expect(boardContentSchema.safeParse({background:"pegboard",items:[{...item,kind:"photo"}]}).success).toBe(false);
  });
  it("bounds items and normalizes rotation",()=>{
    expect(clampBoardItem({...item,x:1500,y:-5,width:900,rotation:365})).toMatchObject({x:640,y:0,width:560,rotation:5});
  });
  it("resolves a stable photo ID when source photos change order or URLs",()=>{
    const visit={id:"v",groupId:"g",place:{name:"공원"},isPlanned:false,photoIds:["p2","p1"],photoUrls:["new2","new1"]} as Visit;
    const photo={...item,kind:"photo" as const,visitId:"v",photoId:"p1"};
    expect(resolveBoardPhoto(photo,[visit])?.url).toBe("new1");
    expect(resolveBoardPhoto(photo,[{...visit,photoIds:["p2"],photoUrls:["new2"]}])).toBeUndefined();
    expect(resolveBoardPhoto(photo,[{...visit,deletedAt:"2026-10-13"}])).toBeUndefined();
  });
});
