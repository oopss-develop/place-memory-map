import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, filterVisits } from "./visit-filter";
import type { Visit } from "@/types/domain";
const base: Visit = { id:"a", groupId:"g", place:{id:"p",provider:"manual",name:"서울 숲",address:"성동구",category:"",latitude:37,longitude:127}, visitedOn:"2026-10-01",isPlanned:false,title:"산책",note:"피크닉",rating:4,tags:["산책"],participants:[{id:"u1",displayName:"나",initials:"나"}],photoUrls:[],markerStyle:"black-9",version:1,updatedBy:"나" };
const rows=[base,{...base,id:"b",visitedOn:"2026-10-02",isPlanned:true,rating:5,tags:["맛집"],participants:[{id:"u2",displayName:"너",initials:"너"}]},{...base,id:"deleted",deletedAt:"2026-10-02"}];
describe("record filters",()=>{
  it("matches all four searchable fields and excludes deleted records",()=>{
    for(const query of ["서울 숲","성동구","산책","피크닉"]) expect(filterVisits(rows,{...EMPTY_FILTERS,query})).toHaveLength(2);
    expect(filterVisits(rows,{...EMPTY_FILTERS,query:"없는 장소"})).toEqual([]);
  });
  it("combines different filters with AND and selections within a filter with OR",()=>{
    expect(filterVisits(rows,{...EMPTY_FILTERS,tags:["산책","맛집"],participants:["u1","u2"],status:"planned",from:"2026-10-02",to:"2026-10-02"}).map(x=>x.id)).toEqual(["b"]);
    expect(filterVisits(rows,{...EMPTY_FILTERS,tags:["맛집"],participants:["u1"]})).toEqual([]);
  });
  it("sorts dates both ways and ratings without mutating input",()=>{
    expect(filterVisits(rows,EMPTY_FILTERS).map(x=>x.id)).toEqual(["b","a"]);
    expect(filterVisits(rows,{...EMPTY_FILTERS,sort:"oldest"}).map(x=>x.id)).toEqual(["a","b"]);
    expect(filterVisits(rows,{...EMPTY_FILTERS,sort:"rating"}).map(x=>x.id)).toEqual(["b","a"]);
    expect(rows[0].id).toBe("a");
  });
});
