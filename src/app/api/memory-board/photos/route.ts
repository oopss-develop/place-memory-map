import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import { MAX_VISIT_IMAGE_BYTES } from "@/lib/images";
import { memoryBoardError } from "@/lib/memory-board-server";
export async function POST(request:Request) {
  const auth=await getAccessWorkspaceUser();
  if(!auth)return NextResponse.json({error:"로그인이 필요합니다."},{status:401});
  try {
    const form=await request.formData();const file=form.get("photo");
    const parsed=z.object({groupId:z.string().uuid(),photoId:z.string().uuid(),name:z.string().trim().min(1).max(120)}).safeParse({groupId:form.get("groupId"),photoId:form.get("photoId"),name:form.get("name")});
    if(!parsed.success||!(file instanceof File)||file.type!=="image/webp"||file.size<12||file.size>MAX_VISIT_IMAGE_BYTES)
      return NextResponse.json({error:"사진은 압축된 WebP 350KB 이하로 올려 주세요."},{status:400});
    const bytes=Buffer.from(await file.arrayBuffer());
    if(bytes.toString("ascii",0,4)!=="RIFF"||bytes.toString("ascii",8,12)!=="WEBP")return NextResponse.json({error:"올바른 WebP 사진 파일을 선택해 주세요."},{status:400});
    const {data:reserved,error:reserveError}=await auth.supabase.rpc("reserve_memory_board_photo",{target_group:parsed.data.groupId,photo_id:parsed.data.photoId,photo_hash:createHash("sha256").update(bytes).digest("hex"),photo_bytes:bytes.length,photo_name:parsed.data.name});
    if(reserveError)throw reserveError;if(!reserved)throw new Error("사진 저장을 준비하지 못했습니다.");
    if(reserved.upload_state!=="complete") {
      const {error:uploadError}=await auth.supabase.storage.from("visit-photos").upload(reserved.storage_path,bytes,{contentType:"image/webp",upsert:false});
      if(uploadError&&String(uploadError.statusCode)!=="409")throw new Error("사진 업로드에 실패했어요. 다시 시도해 주세요.");
      const {error:completeError}=await auth.supabase.rpc("complete_memory_board_photo",{target_photo:reserved.id});if(completeError)throw completeError;
    }
    const {data:link,error:linkError}=await auth.supabase.storage.from("visit-photos").createSignedUrl(reserved.storage_path,3600);
    if(linkError||!link?.signedUrl)throw new Error("사진 링크를 불러오지 못했어요. 다시 시도해 주세요.");
    return NextResponse.json({photo:{key:`upload:${reserved.id}`,uploadId:reserved.id,url:link.signedUrl,title:reserved.file_name,place:"직접 올린 사진",date:reserved.created_at.slice(0,10)}});
  } catch(error){return memoryBoardError(error);}
}
