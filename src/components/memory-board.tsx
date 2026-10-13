"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import dynamic from "next/dynamic";
import Moveable from "react-moveable";
import { ArrowLeft, Check, ImagePlus, LoaderCircle, Pin, Redo2, RotateCcw, Save, StickyNote, Trash2, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "./ui/button";
import { Brand } from "./brand";
import { boardPhotos, BOARD_HEIGHT, BOARD_LIMIT, BOARD_WIDTH, clampBoardItem, resolveBoardPhoto, type BoardItem, type BoardContent } from "@/lib/memory-board";
import { useMemoryBoard } from "@/lib/use-memory-board";
import type { Group, Visit } from "@/types/domain";
import type { PaperInteraction } from "./paper-board";
const PaperBoard = dynamic(()=>import("./paper-board"),{ssr:false});

export default function MemoryBoard({ groupId, groups, visits, viewerId, demo, onClose, onGroup, onVisit }: {
  groupId: string; groups: Group[]; visits: Visit[]; viewerId: string; demo: boolean;
  onClose: ()=>void; onGroup: (id:string)=>void; onVisit: (visitId:string)=>void;
}) {
  const store = useMemoryBoard(groupId,viewerId,demo);
  const [selectedId,setSelectedId]=useState<string>();
  const [target,setTarget]=useState<HTMLElement|null>(null);
  const [preview,setPreview]=useState<BoardItem|null>(null);
  const previewRef=useRef<BoardItem|null>(null);
  const [interaction,setInteraction]=useState<PaperInteraction>({x:0.5,strength:1});
  const [ready,setReady]=useState<Set<string>>(new Set());
  const [graphics,setGraphics]=useState(true);
  const [reduced,setReduced]=useState(false);
  const [tray,setTray]=useState(false);
  const [photoQuery,setPhotoQuery]=useState("");
  const [zoom,setZoom]=useState(0.75);
  const stageRef=useRef<HTMLDivElement>(null);
  const viewportRef=useRef<HTMLDivElement>(null);
  const autoFit=useRef(true);
  const moveable=useRef<Moveable>(null);
  const gesture=useRef(false);
  const [gestureItem,setGestureItem]=useState<string>();
  const touchTimer=useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(()=>()=>clearTimeout(touchTimer.current),[]);
  const groupVisits=useMemo(()=>visits.filter(v=>v.groupId===groupId),[visits,groupId]);
  const photos=useMemo(()=>boardPhotos(groupVisits),[groupVisits]);
  const shownPhotos=photos.filter(p=>`${p.title} ${p.place} ${p.date}`.toLowerCase().includes(photoQuery.toLowerCase()));
  const items=store.board.items.map(item=>preview?.id===item.id ? preview : item);
  const selected=items.find(item=>item.id===selectedId);
  const disabled=store.loading || store.saving;
  const full=items.length>=BOARD_LIMIT;
  const onReady=useCallback((id:string,value:boolean)=>setReady(old=>{
    if(old.has(id)===value) return old; const next=new Set(old); if(value) next.add(id); else next.delete(id); return next;
  }),[]);
  const onFailure=useCallback(()=>{setGraphics(false);setReady(new Set());},[]);
  useEffect(()=>{
    const media=matchMedia("(prefers-reduced-motion: reduce)"); const update=()=>setReduced(media.matches); update();
    media.addEventListener("change",update); return ()=>media.removeEventListener("change",update);
  },[]);
  const fitBoard=useCallback(()=>{
    const el=viewportRef.current; if(!el)return;
    const style=getComputedStyle(el);
    const width=el.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-2;
    const height=el.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-2;
    setZoom(Math.max(0.01,Math.min(1,width/BOARD_WIDTH,height/BOARD_HEIGHT)));
    el.scrollLeft=0;el.scrollTop=0;
  },[]);
  useEffect(()=>{
    const el=viewportRef.current; if(!el)return;
    const observer=new ResizeObserver(()=>{if(autoFit.current)fitBoard();});
    observer.observe(el);return ()=>observer.disconnect();
  },[fitBoard]);
  function changeZoom(delta:number) {
    autoFit.current=false;
    setZoom(value=>Math.max(0.1,Math.min(1.5,value+delta)));
  }
  useLayoutEffect(()=>{
    const el=stageRef.current?.querySelector<HTMLElement>(`[data-board-id="${selectedId}"]`) ?? null;
    setTarget(el); moveable.current?.updateRect();
  },[selectedId,zoom]);
  function changeItems(next:BoardItem[]) { store.change({...store.board,items:next}); }
  function patch(patch:Partial<BoardItem>) {
    if(!selected)return; changeItems(store.board.items.map(item=>item.id===selected.id ? clampBoardItem({...item,...patch}) : item));
  }
  function create(kind:BoardItem["kind"],photo?:typeof photos[number]) {
    if(disabled || full)return;
    const index=items.length;
    const item:BoardItem={id:crypto.randomUUID(),kind,x:110+(index%4)*190,y:95+(Math.floor(index/4)%3)*175,
      width:kind==="photo" ? 250 : 230,height:kind==="photo" ? 290 : 210,
      rotation:[-5,3,-2,6][index%4],text:kind==="photo" ? photo?.place ?? "" : "",color:"cream",attachment:"tape",
      ...(photo ? {visitId:photo.visitId,photoId:photo.photoId} : {})};
    changeItems([...items,clampBoardItem(item)]); setSelectedId(item.id);setTray(false);

  }
  function select(id:string,element:HTMLElement) {setSelectedId(id);setTarget(element);}
  function begin() {gesture.current=true;setGestureItem(selected?.id);setInteraction({x:0.5,strength:0});}
  function transient(item:BoardItem) {const next=clampBoardItem(item);previewRef.current=next;flushSync(()=>setPreview(next));}
  function finish() {
    if(previewRef.current) changeItems(store.board.items.map(item=>item.id===previewRef.current?.id ? previewRef.current : item) as BoardItem[]);
    previewRef.current=null;setPreview(null);gesture.current=false;setGestureItem(undefined);
  }
  function content(patch:Partial<BoardContent>) {store.change({...store.board,...patch});}
  function remove() {if(!selected)return;changeItems(items.filter(item=>item.id!==selected.id));setSelectedId(undefined);}
  function keyboard(event:React.KeyboardEvent) {
    if(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement)return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z") {event.preventDefault();store.undo(event.shiftKey);return;}
    if(!selected || disabled)return;
    const distance=event.shiftKey ? 10 : 2;
    const movement:Record<string,[number,number]>={ArrowLeft:[-distance,0],ArrowRight:[distance,0],ArrowUp:[0,-distance],ArrowDown:[0,distance]};
    if(movement[event.key]) {event.preventDefault();patch({x:selected.x+movement[event.key][0],y:selected.y+movement[event.key][1]});}
    if(event.key==="Delete" || event.key==="Backspace") {event.preventDefault();remove();}
    if(event.key==="Escape") {setSelectedId(undefined);setTray(false);}
  }
  const selectedPhoto=selected ? resolveBoardPhoto(selected,groupVisits) : undefined;
  return <div className="memory-board-app" onKeyDown={keyboard}>
    <header className="memory-board-header">
      <Button variant="ghost" onClick={onClose} disabled={store.saving}><ArrowLeft size={18}/>기록으로</Button>
      <div className="memory-board-title"><Brand compact/><h1>추억 보드</h1></div>
      <select aria-label="보드 지도 선택" value={groupId} disabled={store.saving} onChange={e=>onGroup(e.target.value)}>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select>
      <Button onClick={()=>void store.save()} disabled={disabled || !store.dirty || store.conflict}>{store.saving ? <LoaderCircle className="board-spinner" size={16}/> : store.dirty ? <Save size={16}/> : <Check size={16}/>}<span>{store.saving ? "저장 중" : store.dirty ? "보드 저장" : "저장됨"}</span></Button>
    </header>
    <div className="memory-board-toolbar" aria-label="보드 도구">
      <div><Button variant="outline" onClick={()=>setTray(v=>!v)} aria-expanded={tray} disabled={disabled||full}><ImagePlus size={17}/>사진 붙이기</Button><Button variant="outline" onClick={()=>create("note")} disabled={disabled||full}><StickyNote size={17}/>포스트잇</Button></div>
      <div><Button variant="ghost" aria-label="되돌리기" disabled={disabled||!store.canUndo} onClick={()=>store.undo()}><Undo2 size={18}/></Button><Button variant="ghost" aria-label="다시 실행" disabled={disabled||!store.canRedo} onClick={()=>store.undo(true)}><Redo2 size={18}/></Button><span className="board-toolbar-divider"/><Button variant="ghost" aria-label="보드 축소" disabled={zoom<=0.1} onClick={()=>changeZoom(-0.1)}><ZoomOut size={17}/></Button><button className="board-fit" onClick={()=>{autoFit.current=true;fitBoard();}} aria-label="보드를 화면에 맞추기">{Math.round(zoom*100)}%</button><Button variant="ghost" aria-label="보드 확대" disabled={zoom>=1.5} onClick={()=>changeZoom(0.1)}><ZoomIn size={17}/></Button></div>
      <select aria-label="보드 배경" value={store.board.background} onChange={e=>content({background:e.target.value as BoardContent["background"]})} disabled={disabled}><option value="pegboard">밝은 페그보드</option><option value="whiteboard">화이트보드</option><option value="cork">코르크보드</option></select>
    </div>
    <div className="board-status" role="status" aria-live="polite">{store.loading ? "보드 불러오는 중…" : store.message || (store.dirty ? "아직 저장하지 않은 배치가 있어요." : demo ? "데모 보드는 이 기기에 저장돼요." : "지도 멤버들과 함께 꾸미는 보드예요.")}<span>{items.length} / {BOARD_LIMIT}</span></div>
    {store.error && <div className="board-error" role="alert"><span>{store.error}</span><Button variant="outline" onClick={()=>void store.reload()} disabled={disabled}>{store.conflict ? "최신 보드 불러오기" : "다시 불러오기"}</Button></div>}
    <div className="memory-board-workspace">
      {tray && <aside className="board-photo-tray" aria-label="붙일 사진"><div className="board-panel-heading"><h2>우리의 사진</h2><Button variant="ghost" onClick={()=>setTray(false)}>닫기</Button></div><input type="search" aria-label="보드 사진 검색" placeholder="장소나 기록으로 찾기" value={photoQuery} onChange={e=>setPhotoQuery(e.target.value)}/><p>방문 기록에 담긴 사진을 골라 주세요.</p><div className="board-photo-options">{shownPhotos.map(photo=><button key={photo.key} onClick={()=>create("photo",photo)} disabled={full}><img src={photo.url} alt={photo.title} loading="lazy"/><strong>{photo.place}</strong><small>{photo.date}</small></button>)}</div>{!shownPhotos.length && <p>{photos.length ? "검색에 맞는 사진이 없어요." : "방문 기록에 사진을 추가하면 여기에서 붙일 수 있어요."}</p>}</aside>}
      <div className="board-viewport" ref={viewportRef}>
        <div className="board-scale-box" style={{width:BOARD_WIDTH*zoom,height:BOARD_HEIGHT*zoom}}>
          <div ref={stageRef} className={`board-stage board-${store.board.background}`} style={{width:BOARD_WIDTH,height:BOARD_HEIGHT,transform:`scale(${zoom})`}}
            onPointerDown={e=>{if(e.target===e.currentTarget) {setSelectedId(undefined);setTarget(null);}}}>
            {graphics && items.length>0 && <div className="board-webgl" aria-hidden="true"><PaperBoard items={items} drawingItems={gestureItem ? store.board.items : items} visits={groupVisits} interaction={interaction} reduced={reduced} onReady={onReady} onFailure={onFailure}/></div>}
            {!items.length && !store.loading && <div className="board-empty" style={{ transform: `translate(-50%, -50%) scale(${1/zoom})` }}><Pin size={30} strokeWidth={1.4}/><h2>함께한 순간을<br/>여기에 붙여 두세요.</h2><p>사진 한 장, 짧은 메모 하나.<br/>우리의 이야기가 모이는 작은 벽이에요.</p><Button onClick={()=>setTray(true)} disabled={disabled}><ImagePlus size={17}/>첫 사진 붙이기</Button><button onClick={()=>create("note")} disabled={disabled}>메모부터 남기기</button></div>}
            {items.map((item,index)=>{
              const photo=resolveBoardPhoto(item,groupVisits);
              const enhanced=graphics && ready.has(item.id);
              return <div key={item.id} data-board-id={item.id} data-kind={item.kind} tabIndex={0} role="button" aria-pressed={selectedId===item.id}
                aria-label={item.kind==="photo" ? `사진: ${photo?.place??"불러올 수 없는 사진"}` : `포스트잇: ${item.text||"새 메모"}`}
                className={`board-item board-item-${item.kind} board-note-${item.color} ${enhanced?"board-item-enhanced":""} ${selectedId===item.id?"board-item-selected":""}`}
                style={{width:item.width,height:item.height,transform:`translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg)`,zIndex:index+2}}
                onFocus={e=>select(item.id,e.currentTarget)} onClick={e=>select(item.id,e.currentTarget)}
                onPointerDown={e=>{if(disabled)return;flushSync(()=>select(item.id,e.currentTarget));if(e.pointerType==="touch")setInteraction({id:item.id,x:0.5,strength:1});}}
                onMouseDown={e=>{if(disabled||e.button!==0)return;flushSync(()=>select(item.id,e.currentTarget));moveable.current?.dragStart(e.nativeEvent);}}
                onTouchEnd={()=>{setInteraction({id:item.id,x:0.5,strength:1});clearTimeout(touchTimer.current);touchTimer.current=setTimeout(()=>setInteraction({x:0.5,strength:0}),160);}}
                onTouchStart={e=>{if(disabled)return;flushSync(()=>select(item.id,e.currentTarget));moveable.current?.dragStart(e.nativeEvent);}}
                onPointerMove={e=>{if(gesture.current||e.pointerType==="touch"||reduced)return;const bounds=e.currentTarget.getBoundingClientRect();setInteraction({id:item.id,x:Math.max(0,Math.min(1,(e.clientX-bounds.left)/bounds.width)),strength:0.6+Math.max(0,Math.min(1,(e.clientY-bounds.top)/bounds.height))*0.7});}}
                onPointerLeave={()=>{if(!gesture.current)setInteraction({x:0.5,strength:0});}}>
                <span className={`board-attachment board-attachment-${item.attachment}`} aria-hidden="true"/>
                <div className="board-paper-fallback">{item.kind==="photo" ? <>{photo ? <img src={photo.url} alt="" draggable={false}/> : <div className="board-photo-missing">사진을 불러올 수 없어요<br/><small>기록이 삭제되었거나 사진 주소가 만료됐어요.</small></div>}<span>{item.text||photo?.place||"우리의 사진"}</span></> : <p>{item.text||"여기에 우리의 이야기를 남겨요."}</p>}</div>
              </div>;
            })}
            <Moveable flushSync={flushSync} ref={moveable} target={disabled?null:target} container={stageRef.current} draggable resizable rotatable keepRatio={selected?.kind==="photo"} origin={false} snappable={["draggable"]} snapGridWidth={10} snapGridHeight={10} throttleRotate={1} zoom={1/zoom} renderDirections={["nw","ne","sw","se"]}
              onDragStart={e=>{begin();e.set([selected?.x??0,selected?.y??0]);}}
              onDrag={e=>{if(selected)transient({...selected,x:e.beforeTranslate[0],y:e.beforeTranslate[1]});}} onDragEnd={finish}
              onResizeStart={e=>{
                if(!selected)return false;
                begin();e.set([selected.width,selected.height]);e.setOrigin(["50%","50%"]);
                const ratio=selected.width/selected.height;
                e.setMin(selected.kind==="photo" ? [Math.max(120,100*ratio),Math.max(100,120/ratio)] : [120,100]);
                e.setMax(selected.kind==="photo" ? [Math.min(560,600*ratio),Math.min(600,560/ratio)] : [560,600]);
                if(e.dragStart)e.dragStart.set([selected.x,selected.y]);
              }}
              onResize={e=>{if(selected)transient({...selected,width:e.width,height:e.height,x:e.drag.beforeTranslate[0],y:e.drag.beforeTranslate[1]});}} onResizeEnd={finish}
              onRotateStart={e=>{begin();e.set(selected?.rotation??0);if(e.dragStart)e.dragStart.set([selected?.x??0,selected?.y??0]);}}
              onRotate={e=>{if(selected)transient({...selected,rotation:e.beforeRotate,x:e.drag.beforeTranslate[0],y:e.drag.beforeTranslate[1]});}} onRotateEnd={finish}/>
          </div>
        </div>
      </div>
      <aside className="board-properties" aria-label="사진과 메모 편집">
        {selected ? <><div className="board-panel-heading"><h2>{selected.kind==="photo"?"사진 꾸미기":"포스트잇 꾸미기"}</h2><Button variant="ghost" onClick={()=>setSelectedId(undefined)}>닫기</Button></div>
          <label>{selected.kind==="photo"?"사진 아래 한마디":"메모"}<textarea aria-label={selected.kind==="photo"?"사진 설명":"포스트잇 내용"} value={selected.text} maxLength={500} rows={selected.kind==="photo"?2:5} disabled={disabled} placeholder={selected.kind==="photo"?"이 순간을 기억하는 한마디":"그날의 이야기, 다음에 하고 싶은 일…"} onChange={e=>patch({text:e.target.value})}/></label>
          <div className="board-number-fields">{([['x','가로 위치'],['y','세로 위치'],['width','너비'],['height','높이'],['rotation','각도']] as const).map(([key,label])=><label key={key}>{label}<div><input type="number" aria-label={label} value={Math.round(selected[key])} disabled={disabled} min={key==="rotation"?-180:key==="width"?120:key==="height"?100:0} max={key==="rotation"?180:key==="width"?560:key==="height"?600:key==="x"?BOARD_WIDTH-selected.width:BOARD_HEIGHT-selected.height} onChange={e=>{if(e.target.value!==""&&Number.isFinite(e.target.valueAsNumber))patch({[key]:e.target.valueAsNumber});}}/><span>{key==="rotation"?"°":"px"}</span></div></label>)}</div>
          <label>붙이는 방법<select aria-label="붙이는 방법" value={selected.attachment} disabled={disabled} onChange={e=>patch({attachment:e.target.value as BoardItem["attachment"]})}><option value="tape">마스킹테이프</option><option value="pin">압정</option></select></label>
          {selected.kind==="note" && <fieldset><legend>메모 색상</legend><div className="board-color-options">{([['cream','노랑'],['rose','분홍'],['sage','초록'],['sky','파랑']] as const).map(([color,label])=><button key={color} className={`board-swatch-${color}`} aria-label={`${label} 메모`} aria-pressed={selected.color===color} disabled={disabled} onClick={()=>patch({color})}>{selected.color===color&&<Check size={16}/>}</button>)}</div></fieldset>}
          <div className="board-property-actions"><Button variant="outline" onClick={()=>patch({rotation:0})} disabled={disabled}><RotateCcw size={15}/>각도 초기화</Button><Button variant="outline" disabled={disabled||items.at(-1)?.id===selected.id} onClick={()=>changeItems([...items.filter(i=>i.id!==selected.id),selected])}>맨 앞으로</Button><Button variant="outline" disabled={disabled||items[0]?.id===selected.id} onClick={()=>changeItems([selected,...items.filter(i=>i.id!==selected.id)])}>맨 뒤로</Button>{selectedPhoto&&<Button variant="outline" onClick={()=>onVisit(selectedPhoto.visitId)} disabled={store.saving}>원래 기록 보기</Button>}<Button variant="ghost" onClick={remove} disabled={disabled}><Trash2 size={15}/>보드에서 떼기</Button></div><p>보드에서 떼어도 원래 사진과 방문 기록은 남아 있어요.</p>
        </> : <div className="board-properties-hint"><StickyNote size={23} strokeWidth={1.5}/><h2>작은 추억의 벽</h2><p>사진과 메모를 선택해<br/>위치·크기·각도를 바꿔 보세요.</p><p>사진 위로 마우스를 움직이면<br/>종이 끝이 살짝 들려요.</p><small>키보드 방향키로 이동<br/>Shift + 방향키로 크게 이동<br/>Ctrl / ⌘ + Z로 되돌리기</small></div>}
      </aside>
    </div>
  </div>;
}
