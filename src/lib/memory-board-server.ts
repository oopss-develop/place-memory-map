import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { BoardPhotoOption } from "./memory-board";
export function memoryBoardError(error: unknown) {
  const issue=error as {code?:string;message?:string};
  const missing=["42P01","42703","PGRST202","PGRST205"].includes(issue.code??"");
  return NextResponse.json({error:missing ? "보드 사진 DB 업데이트가 필요합니다. 202610130002_memory_board_photos.sql을 적용해 주세요." :
    issue.code==="40001" ? "다른 멤버가 먼저 수정했습니다. 내 배치는 유지했어요. 최신 보드를 확인해 주세요." : issue.message??"보드 사진을 저장하지 못했습니다."},
    {status:missing?503:issue.code==="40001"?409:issue.code==="42501"?403:400});
}
export async function loadBoardPhotos(db:SupabaseClient,groupId:string) {
  const {data,error}=await db.from("memory_board_photos").select("id,storage_path,file_name,created_at").eq("group_id",groupId).eq("upload_state","complete").is("purge_started_at",null).order("created_at",{ascending:false});
  if(error)throw error;
  const rows=data??[]; if(!rows.length)return {photos:[] as BoardPhotoOption[],photoWarning:""};
  const {data:links,error:signError}=await db.storage.from("visit-photos").createSignedUrls(rows.map(photo=>photo.storage_path),3600);
  const photos:BoardPhotoOption[]=rows.flatMap((row,i)=>links?.[i]?.signedUrl ? [{key:`upload:${row.id}`,uploadId:row.id,url:links[i].signedUrl!,title:row.file_name,place:"직접 올린 사진",date:row.created_at.slice(0,10)}] : []);
  return {photos,photoWarning:signError||photos.length!==rows.length ? "일부 보드 사진을 불러오지 못했어요. 다시 불러오기를 눌러 주세요." : ""};
}
