"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { createWorkspaceBackup } from "@/lib/workspace-backup";
import { backupHash, parseManifest, snapshotSchema, validateBackupCoverage } from "@/lib/backup-format";
export function WorkspaceBackup({ userId = "viewer", demo = false }: { userId?: string; demo?: boolean }) {
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [photos,setPhotos]=useState(true);
  const [stickers,setStickers]=useState(true);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [last,setLast]=useState("");
  const dialog=useRef<HTMLDialogElement>(null);
  const controller=useRef<AbortController | null>(null);
  const lock=useRef(false);
  const key=`uttumak-backup-last-${userId}`;
  useEffect(()=>{const timer=setTimeout(()=>{try {setLast(localStorage.getItem(key) ?? "");}catch{}},0);return()=>clearTimeout(timer);},[key]);
  useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  function close(){controller.current?.abort();setOpen(false);}
  async function download() {
    if(lock.current || demo)return;
    lock.current=true;setBusy(true);setError("");setMessage("");
    const abort=new AbortController();controller.current=abort;
    try {
      const result=await createWorkspaceBackup(createSupabaseBrowserClient(),{photos,stickers,signal:abort.signal,progress:setMessage});
      const url=URL.createObjectURL(result.blob);const link=document.createElement("a");link.href=url;link.download=result.filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      const date=new Date().toISOString();try {localStorage.setItem(key,date);}catch{}setLast(date);
      setMessage(`백업 파일을 만들었어요. 내려받은 ZIP을 안전한 곳에 보관하세요. 지도 ${result.snapshot.data.groups.length}개 · 기록 ${result.snapshot.data.visits.length}개 · 댓글 ${result.snapshot.data.visit_comments.length}개`);
    }catch(reason){setError(abort.signal.aborted ? "백업을 중단했어요. 완료 파일은 만들어지지 않았습니다." : (reason as Error).message);setMessage("");}
    finally{lock.current=false;setBusy(false);controller.current=null;}
  }
  async function verify(file:File) {
    if(lock.current)return;
    lock.current=true;setBusy(true);setError("");setMessage("백업 파일을 확인하는 중…"); const abort=new AbortController();controller.current=abort;
    try {
      if(file.size>512*1024*1024)throw new Error("512MB 이상 파일은 PC 복원 도구에서 확인해 주세요.");
      const {default:JSZip}=await import("jszip");const zip=await JSZip.loadAsync(await file.arrayBuffer());
      const manifestFile=zip.file("manifest.json");if(!manifestFile)throw new Error("우뚜막 백업 파일이 아닙니다.");
      const manifest=parseManifest(JSON.parse(await manifestFile.async("string")));
      let bytes=0;
      for(const [i,item] of manifest.files.entries()) {
        abort.signal.throwIfAborted(); const entry=zip.file(item.path);if(!entry)throw new Error(`백업 파일이 빠졌어요: ${item.path}`);
        bytes+=item.bytes;if(bytes>512*1024*1024)throw new Error("큰 백업은 PC 복원 도구에서 검사해 주세요.");
        setMessage(`백업 검증 중… ${i+1}/${manifest.files.length}`);
        const data=await entry.async("uint8array");if(data.length!==item.bytes || await backupHash(data)!==item.sha256)throw new Error(`손상된 파일이 있습니다: ${item.path}`);
      }
      if(!manifest.files.some(f=>f.path==="backup.json"))throw new Error("백업 데이터가 검증 목록에 없습니다.");
      const snapshot=snapshotSchema.parse(JSON.parse(await zip.file("backup.json")!.async("string")));
      validateBackupCoverage(manifest,snapshot); abort.signal.throwIfAborted(); setMessage(`파일 검증 완료 · ${new Date(snapshot.createdAt).toLocaleString("ko-KR")} · 기록 ${snapshot.data.visits.length}개 · 사진 ${snapshot.data.visit_photos.filter(p=>p.upload_state!=="pending").length}개. ${manifest.photosIncluded ? "사진 원본 포함" : "사진 제외 데이터 백업"}. 복원은 ZIP 안의 복원안내.md를 따라 진행하세요.`);
    }catch(reason){setError((reason as Error).message);setMessage("");}finally{setBusy(false);lock.current=false;controller.current=null;}
  }
  return <><Button type="button" variant="outline" className="workspace-backup-button" onClick={()=>{setError("");setMessage("");setOpen(true);}}><ShieldCheck size={17} aria-hidden="true"/>전체 백업</Button>{open && createPortal(<dialog ref={dialog} className="workspace-backup-dialog" aria-label="전체 백업과 복원" onClose={close} onCancel={close} onKeyDown={event=>{if(event.key==="Escape")event.stopPropagation();}}>
    <header><div><h2>소중한 기록 보관하기</h2><p>인터넷 없이도 열어 볼 수 있는 백업 파일</p></div><Button type="button" variant="ghost" onClick={close}>닫기</Button></header>
    <p>접근 가능한 모든 지도의 기록·댓글·여행 일정과 사진 원본을 ZIP에 담습니다. 휴지통의 남아 있는 기록도 포함해요.</p>
    <div className="backup-options"><label><input type="checkbox" checked={photos} disabled={busy} onChange={event=>setPhotos(event.target.checked)}/>사진 원본 포함</label><label><input type="checkbox" checked={stickers} disabled={busy} onChange={event=>setStickers(event.target.checked)}/>이모티콘 파일 포함</label></div>
    {!photos && <p className="backup-note">사진을 제외하면 데이터 백업이며 사진까지 전체 복원할 수는 없어요.</p>}
    <p className="backup-note">기록과 사진은 덮어쓰지 않습니다. 백업 파일에는 비밀번호가 포함되지 않아요. 사진이 많으면 PC에서 진행해 주세요. 큰 백업은 폴더 백업 도구를 사용할 수 있습니다.</p>
    {last && <p className="backup-note">최근 백업 파일 생성: {new Date(last).toLocaleString("ko-KR")}</p>}
    {demo ? <p>로그인하고 저장소를 연결하면 전체 백업을 내려받을 수 있어요.</p> : <div className="backup-actions"><Button type="button" disabled={busy} onClick={()=>void download()}><Download size={17}/>{photos ? "전체 백업 내려받기" : "데이터 백업 내려받기"}</Button><label className="backup-verify">백업 파일 확인<input type="file" accept=".zip" disabled={busy} onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)void verify(file);}}/></label>{busy && <Button type="button" variant="outline" onClick={()=>controller.current?.abort()}>중단</Button>}</div>}
    {message && <p role="status" className="backup-progress">{message}</p>}{error && <p role="alert" className="visit-comments-error">{error}</p>}
    <details><summary>나중에 복원하는 방법</summary><p>ZIP을 풀어 기록보기.html을 열면 메모와 사진을 볼 수 있어요. 앱으로 복원하려면 복원안내.md에 있는 PC 도구를 사용하세요. 검사 후 누락된 데이터만 추가하며 기존 기록을 덮어쓰지 않습니다.</p><p>각자 자기 계정으로 백업하면 본인의 즐겨찾기와 읽음 상태도 보관됩니다. 이미 영구 삭제된 파일, 로그인 계정 비밀번호, 아직 올리지 않은 사진은 포함되지 않습니다. PC 도구는 서버 관리자 연결 정보가 필요하며 브라우저에 관리자 키를 입력하지 않습니다.</p></details>
  </dialog>,document.body)}</>;
}
