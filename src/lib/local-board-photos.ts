import type { BoardPhotoOption } from "./memory-board";
interface LocalBoardPhoto { id:string; groupId:string; name:string; file:Blob; createdAt:string }
function openPhotos():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open("uttumak-board-photos-v1",1);
    request.onupgradeneeded=()=>request.result.createObjectStore("photos",{keyPath:"id"}).createIndex("groupId","groupId");
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error("이 기기에 사진을 저장하지 못했어요."));
  });
}
function option(row:LocalBoardPhoto):BoardPhotoOption {return {key:`upload:${row.id}`,uploadId:row.id,url:URL.createObjectURL(row.file),title:row.name,place:"직접 올린 사진",date:row.createdAt.slice(0,10)};}
export async function loadLocalBoardPhotos(groupId:string) {
  if(typeof indexedDB==="undefined")return [];
  const db=await openPhotos();
  try {return await new Promise<BoardPhotoOption[]>((resolve,reject)=>{
    const transaction=db.transaction("photos","readonly");const request=transaction.objectStore("photos").index("groupId").getAll(groupId);
    transaction.oncomplete=()=>resolve((request.result as LocalBoardPhoto[]).map(option));transaction.onerror=()=>reject(new Error("저장된 사진을 불러오지 못했어요."));
  });} finally {db.close();}
}
export async function saveLocalBoardPhoto(groupId:string,id:string,name:string,file:File) {
  const db=await openPhotos();const row:LocalBoardPhoto={id,groupId,name,file,createdAt:new Date().toISOString()};
  try {await new Promise<void>((resolve,reject)=>{
    const transaction=db.transaction("photos","readwrite");transaction.objectStore("photos").put(row);
    transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(new Error("기기 저장 공간이 부족해 사진을 보관하지 못했어요."));
  });return option(row);} finally {db.close();}
}
