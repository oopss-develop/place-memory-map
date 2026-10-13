import { MAX_VISIT_IMAGE_BYTES, prepareVisitImage } from "./images";
export interface PreparedBoardImage {file:File;width:number;height:number}
export const BOARD_IMAGE_ACCEPT="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,image/heic,image/heif,.heic,.heif";
export function isBoardImage(file:File) {return /^image\/(jpeg|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.type)||/\.(jpe?g|png|webp|gif|bmp|avif|hei[cf])$/i.test(file.name);}
export async function prepareBoardImage(source:File):Promise<PreparedBoardImage> {
  if(!isBoardImage(source))throw new Error("JPG, PNG, WebP, HEIC 등의 사진 파일을 선택해 주세요.");
  if(source.size>30*1024*1024)throw new Error("원본 사진은 30MB 이하로 선택해 주세요.");
  const file=await prepareVisitImage(source);
  if(file.size>MAX_VISIT_IMAGE_BYTES)throw new Error("사진을 충분히 줄이지 못했어요. 더 작은 사진으로 다시 시도해 주세요.");
  if(typeof createImageBitmap!=="undefined") {
    const image=await createImageBitmap(file);const result={file,width:image.width,height:image.height};image.close();return result;
  }
  const url=URL.createObjectURL(file);
  try {return await new Promise<PreparedBoardImage>((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve({file,width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(new Error("사진을 읽지 못했어요."));image.src=url;
  });} finally {URL.revokeObjectURL(url);}
}
