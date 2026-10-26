"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, MapPin, Plus, Search, Stamp, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { useConfirmation } from "./confirmation";
import { apiRequest, jsonRequest } from "@/lib/api-request";
import { bucketSchema, bucketStatus } from "@/lib/bucket-list";
import { usePlaceSearch } from "@/lib/use-place-search";
import { placeSchema } from "@/lib/schemas";
import { clearDraft, saveDraft, listDrafts } from "@/lib/drafts";
import type { BucketComment, BucketItem, Group, Place, Visit } from "@/types/domain";

type Props = {
  groupId: string; groups: Group[]; visits: Visit[]; viewerId: string; viewerName: string; demo: boolean;
  onClose: () => void; onGroup: (id: string) => void;
  onStamp: (item: BucketItem, place: Place) => void; onVisit: (id: string) => void;
};
const labels = { wish: "하고 싶은 것", planned: "일정 잡음", completed: "완료" };

export function BucketList(props: Props) {
  const { groupId, visits, viewerId, demo } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<BucketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editor, setEditor] = useState<BucketItem | "new" | null>(null);
  const [detail, setDetail] = useState<string>();
  const [stamping, setStamping] = useState<BucketItem>();
  const [busy, setBusy] = useState(false);
  const confirmation = useConfirmation();
  const storageKey = `place-memory-bucket-list:${viewerId}:${groupId}`;
  const load = useCallback(async (signal?: AbortSignal) => {
    if (demo) {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (!Array.isArray(value)) throw new Error("저장된 버킷리스트를 확인할 수 없습니다.");
      setItems(value);
    } else {
      const data = await apiRequest<{ items: BucketItem[] }>(`/api/bucket-list?groupId=${groupId}`, { signal });
      if (!signal?.aborted) setItems(data.items);
    }
  }, [demo, groupId, storageKey]);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const initial = setTimeout(() => { void load(controller.signal).then(() => setError("")).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); }, 0);
    const sync = () => { if (!document.hidden) void load(controller.signal).catch(() => {}); };
    const timer = setInterval(sync, 30000);
    window.addEventListener("focus", sync);
    return () => { clearTimeout(initial); controller.abort(); clearInterval(timer); window.removeEventListener("focus", sync); };
  }, [load, visits]);
  const visible = items.filter(item => (filter === "all" || bucketStatus(item, visits) === filter) && [item.title, item.reason, item.place?.name, item.place?.address, ...item.tags].join(" ").toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a, b) => Number(bucketStatus(a, visits) === "completed") - Number(bucketStatus(b, visits) === "completed") || b.created_at.localeCompare(a.created_at));
  function update(next: BucketItem[]) { if (demo) localStorage.setItem(storageKey, JSON.stringify(next)); setItems(next); }
  async function remove(item: BucketItem) {
    if (!await confirmation.confirm(`“${item.title}” 버킷리스트를 삭제할까요? 연결된 방문 기록은 유지됩니다.`)) return;
    setBusy(true); setError("");
    try { if (!demo) await apiRequest("/api/bucket-list", jsonRequest("DELETE", { id: item.id, version: item.version })); update(items.filter(row => row.id !== item.id)); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  function stamp(item: BucketItem) {
    const visit = visits.find(v => v.id === item.visit_id && !v.deletedAt);
    const place = visit?.place ?? item.place;
    if (place) props.onStamp(item, { ...place, id: place.id ?? item.id });
    else setStamping(item);
  }
  return <dialog ref={dialog} className="bucket-dialog" aria-labelledby="bucket-heading" onCancel={event => { event.preventDefault(); if (!busy) props.onClose(); }}>
    <header className="bucket-header"><Button variant="ghost" disabled={busy} onClick={props.onClose} aria-label="기록으로 돌아가기"><ArrowLeft />기록</Button><h1 id="bucket-heading">버킷리스트</h1><label className="bucket-workspace">함께 보는 지도<select aria-label="버킷리스트 지도 선택" value={groupId} disabled={busy} onChange={event => props.onGroup(event.target.value)}>{props.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><Button disabled={loading || !!editor || busy} onClick={() => setEditor("new")}><Plus />추가</Button></header>
    <div className="bucket-content">
      <p className="bucket-muted">날짜는 나중에. 가고 싶은 곳과 하고 싶은 일을 먼저 모아두세요.</p>
      {demo && <p className="bucket-muted">체험 모드 · 이 기기에 저장됩니다.</p>}
      {error && <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => void load().then(() => setError("")).catch(error => setError(error.message))}>새로고침</Button></div>}
      {editor && <BucketPopup label={editor === "new" ? "버킷리스트 추가" : "버킷리스트 수정"} busy={busy} onClose={() => setEditor(null)}><BucketEditor key={editor === "new" ? "new" : editor.id} item={editor === "new" ? undefined : editor} groupId={groupId} visits={visits} viewerId={viewerId} demo={demo} onBusy={setBusy} onCancel={() => setEditor(null)} onSaved={(saved, again) => { update([saved, ...items.filter(item => item.id !== saved.id)]); setEditor(null); if (again) setTimeout(() => setEditor("new"), 0); }} /></BucketPopup>}
      {stamping && <BucketPopup label="도장깨기 장소 선택" busy={busy} onClose={() => setStamping(undefined)}><section className="bucket-editor" aria-label="도장깨기 장소 선택"><h2>{stamping.title} · 어디에서 할까요?</h2><p>기록에 남길 장소를 선택한 뒤 날짜와 나머지 값을 입력하세요.</p><BucketPlacePicker value={null} onChange={place => { if (place) { props.onStamp(stamping, place); setStamping(undefined); } }} visits={visits} groupId={groupId} /><Button variant="ghost" onClick={() => setStamping(undefined)}>취소</Button></section></BucketPopup>}
      <div className="bucket-tools"><Input aria-label="버킷리스트 검색" placeholder="제목, 이유, 장소, 태그 검색" value={query} onChange={event => setQuery(event.target.value)} /><div className="bucket-filters" aria-label="버킷리스트 상태">{([['all','전체'], ...Object.entries(labels)]).map(([value,label]) => <Button key={value} variant={filter === value ? "default" : "outline"} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</Button>)}</div></div>
      <div className="bucket-list-scroll">{loading ? <p role="status">버킷리스트 불러오는 중…</p> : !visible.length ? <div className="bucket-empty"><Stamp /><h2>{items.length ? "조건에 맞는 항목이 없어요." : "우리의 다음 소망을 적어보세요."}</h2><p>장소와 날짜가 정해지지 않아도 괜찮아요.</p></div> : <ul className="bucket-grid">{visible.map(item => {
        const status = bucketStatus(item, visits);
        const visit = visits.find(v => v.id === item.visit_id && !v.deletedAt);
        return <li key={item.id} className="bucket-card"><div className="bucket-meta"><Badge variant="outline">{item.kind === "place" ? "가고 싶은 곳" : "하고 싶은 것"}</Badge><Badge variant="secondary">{status === "completed" && <Check size={14} />}{labels[status]}</Badge></div><h2><button className="bucket-card-open" disabled={busy} onClick={() => setEditor(item)} aria-label={`${item.title} 세부 입력`}>{item.title}</button></h2>{item.place && <p className="bucket-muted"><MapPin size={14} />{item.place.name}{item.place.address && ` · ${item.place.address}`}</p>}<p className="bucket-reason">{item.reason || "이 버킷리스트를 담은 이유를 남겨보세요."}</p><div className="bucket-tags">{item.tags.map(tag => <Badge key={tag} variant="outline">#{tag}</Badge>)}</div>{visit && <p className="bucket-muted">{status === "completed" ? "완료" : "예정"} · {visit.visitedOn}</p>}<div className="bucket-actions"><Button variant="ghost" onClick={() => setDetail(detail === item.id ? undefined : item.id)} aria-expanded={detail === item.id}>댓글</Button><Button variant="ghost" disabled={busy} onClick={() => setEditor(item)}>수정</Button><Button variant="ghost" disabled={busy} onClick={() => void remove(item)}>삭제</Button>{status === "completed" ? <Button variant="outline" disabled={busy} onClick={() => props.onVisit(item.visit_id!)}>기록 보기</Button> : <Button disabled={busy} onClick={() => stamp(item)}><Stamp />{status === "planned" ? "도장깨기 · 다녀왔어요" : "도장깨기"}</Button>}</div>{detail === item.id && <BucketComments key={item.id} itemId={item.id} viewerId={viewerId} viewerName={props.viewerName} demo={demo} storageKey={storageKey} />}</li>;
      })}</ul>}</div>
      <footer className="bucket-footer">{visible.length}개의 버킷리스트 <span>항목 제목을 눌러 세부 내용을 입력하세요.</span></footer>
    </div>
    {confirmation.dialog}
  </dialog>;
}

function BucketPopup({ label, busy, onClose, children }: { label: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={dialog} className="bucket-popup" aria-label={label} onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!busy) onClose(); }}>
    {children}
  </dialog>;
}

type EditorDraft = { id: string; title: string; reason: string; kind: "place" | "activity"; place: Place | null; tags: string; requestId: string; baseVersion: number };
function BucketEditor({ item, groupId, visits, viewerId, demo, onSaved, onCancel, onBusy }: { item?: BucketItem; groupId: string; visits: Visit[]; viewerId: string; demo: boolean; onSaved: (item: BucketItem, again: boolean) => void; onCancel: () => void; onBusy: (busy: boolean) => void }) {
  const draftKey = `${viewerId}:bucket:${groupId}:${item?.id ?? "new"}`;
  const [form, setForm] = useState<EditorDraft>(() => listDrafts<EditorDraft>(draftKey).find(draft => draft.key === draftKey)?.data ?? { id: item?.id ?? crypto.randomUUID(), title: item?.title ?? "", reason: item?.reason ?? "", kind: item?.kind ?? "place", place: item?.place ?? null, tags: item?.tags.join(", ") ?? "", requestId: crypto.randomUUID(), baseVersion: item?.version ?? 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const latest = useRef(form);
  const keepDraft = useRef(true);
  useEffect(() => { latest.current = form; }, [form]);
  useEffect(() => { const timer = setTimeout(() => saveDraft(draftKey, form), 500); return () => clearTimeout(timer); }, [draftKey, form]);
  useEffect(() => { const flush = () => saveDraft(draftKey, latest.current); window.addEventListener("pagehide", flush); return () => { window.removeEventListener("pagehide", flush); if (keepDraft.current) saveDraft(draftKey, latest.current); }; }, [draftKey]);
  function change(patch: Partial<EditorDraft>) { setForm(current => ({ ...current, ...patch, requestId: crypto.randomUUID() })); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving.current) return;
    const again = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "again";
    const parsed = bucketSchema.safeParse({ ...form, groupId, tags: form.tags.split(",").map(tag => tag.trim()).filter(Boolean), version: form.baseVersion });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "입력을 확인해 주세요.");
    saving.current = true; setBusy(true); onBusy(true); setError("");
    try {
      const saved = demo ? { id: form.id, group_id: groupId, title: parsed.data.title, kind: form.kind, reason: parsed.data.reason, place: form.place, tags: parsed.data.tags, visit_id: item?.visit_id ?? null, version: (item?.version ?? 0) + 1, created_at: item?.created_at ?? new Date().toISOString() } : await apiRequest<BucketItem>("/api/bucket-list", jsonRequest(item ? "PUT" : "POST", parsed.data));
      keepDraft.current = false; clearDraft(draftKey); onSaved(saved, again);
    } catch (error) { setError((error as Error).message); }
    finally { saving.current = false; setBusy(false); onBusy(false); }
  }
  return <form className="bucket-editor" aria-label={item ? "버킷리스트 수정" : "버킷리스트 추가"} onSubmit={submit}>
    <h2>{item ? "버킷리스트 수정" : "새 버킷리스트"}</h2>
    <fieldset disabled={busy}><label>종류<select aria-label="종류" value={form.kind} onChange={event => change({ kind: event.target.value as EditorDraft['kind'] })}><option value="place">가고 싶은 곳</option><option value="activity">하고 싶은 것</option></select></label><label>제목<Input required maxLength={120} value={form.title} onChange={event => change({ title: event.target.value })} placeholder="예: 바다 보면서 커피 마시기" /></label><label>버킷리스트인 이유<Textarea maxLength={3000} value={form.reason} onChange={event => change({ reason: event.target.value })} placeholder="왜 가고 싶거나 하고 싶은지 적어주세요." /></label><label>태그<Input value={form.tags} onChange={event => change({ tags: event.target.value })} placeholder="여행, 체험 (쉼표로 구분, 최대 8개)" /></label><p>장소 <span className="bucket-muted">선택 · 나중에 정해도 돼요</span></p><BucketPlacePicker value={form.place} onChange={place => change({ place })} groupId={groupId} visits={visits} /></fieldset>
    {error && <p role="alert">{error}</p>}<div className="bucket-actions"><Button type="button" variant="ghost" disabled={busy} onClick={() => { saveDraft(draftKey, form); onCancel(); }}>닫기 · 초안 보관</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => { keepDraft.current = false; clearDraft(draftKey); onCancel(); }}>초안 버리기</Button>{!item && <Button type="submit" value="again" variant="outline" disabled={busy}>저장 후 계속 추가</Button>}<Button type="submit" disabled={busy}>{busy ? "저장 중…" : "저장"}</Button></div>
  </form>;
}

export function BucketPlacePicker({ value, onChange, groupId, visits }: { value: Place | null; onChange: (place: Place | null) => void; groupId: string; visits: Visit[] }) {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<"kakao" | "osm">("kakao");
  const [manual, setManual] = useState(false);
  const [error, setError] = useState("");
  const search = usePlaceSearch(query, provider, groupId, visits);
  const [pin, setPin] = useState({ name: "", address: "", latitude: "", longitude: "" });
  const places = Array.from(new Map(visits.filter(v => v.groupId === groupId && !v.deletedAt).map(v => [v.place.id, v.place])).values());
  return <div className="bucket-place-picker">
    {value && <div className="bucket-place-value"><MapPin /><div><strong>{value.name}</strong><p>{value.address}</p></div><Button type="button" variant="ghost" aria-label="장소 제거" onClick={() => onChange(null)}><X /></Button></div>}
    <div className="bucket-search"><select aria-label="장소 검색 지역" value={provider} onChange={event => setProvider(event.target.value as "kakao" | "osm")}><option value="kakao">국내</option><option value="osm">해외</option></select><Input aria-label="버킷리스트 장소 검색" value={query} onChange={event => setQuery(event.target.value)} placeholder="장소 이름 검색" onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void search.search(); } }} /><Button type="button" variant="outline" disabled={search.searching} onClick={() => void search.search()}><Search />찾기</Button></div>
    {search.message && <p role="status">{search.message}</p>}
    <div className="bucket-place-results">{search.results.map(result => <Button key={result.id} type="button" variant="ghost" onClick={() => { onChange(result.existingPlace ?? { id: crypto.randomUUID(), provider: provider === "kakao" ? "kakao" : "manual", providerPlaceId: provider === "kakao" ? result.id : undefined, name: result.placeName, address: result.roadAddressName || result.addressName, category: result.categoryName, latitude: result.latitude, longitude: result.longitude }); search.setResults([]); }}><strong>{result.placeName}</strong><small>{result.roadAddressName || result.addressName}</small></Button>)}</div>
    {places.length > 0 && <select aria-label="기존 기록에서 장소 선택" value="" onChange={event => { const place = places.find(p => p.id === event.target.value); if (place) onChange(place); }}><option value="">기존 기록에서 장소 선택</option>{places.map(p => <option key={p.id} value={p.id}>{p.name} · {p.address}</option>)}</select>}
    <Button type="button" variant="ghost" aria-expanded={manual} onClick={() => setManual(!manual)}>장소 직접 입력</Button>
    {manual && <div className="bucket-manual">{([['name','장소 이름'],['address','주소'],['latitude','위도'],['longitude','경도']] as const).map(([key,label]) => <label key={key}>{label}<Input value={pin[key]} type={key === "latitude" || key === "longitude" ? "number" : "text"} step="any" onChange={event => setPin(current => ({ ...current, [key]: event.target.value }))} /></label>)}<Button type="button" variant="outline" onClick={() => { const parsed = placeSchema.safeParse({ provider: "manual", ...pin, latitude: pin.latitude.trim() ? Number(pin.latitude) : NaN, longitude: pin.longitude.trim() ? Number(pin.longitude) : NaN }); if (!parsed.success) { setError("장소 이름과 올바른 위도·경도를 입력해 주세요."); return; } onChange({ ...parsed.data, id: crypto.randomUUID() }); setManual(false); setError(""); }}>이 장소 선택</Button>{error && <p role="alert">{error}</p>}</div>}
  </div>;
}

function BucketComments({ itemId, viewerId, viewerName, demo, storageKey }: { itemId: string; viewerId: string; viewerName: string; demo: boolean; storageKey: string }) {
  const [comments, setComments] = useState<BucketComment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const lock = useRef(false);
  const url = `/api/bucket-list/${itemId}/comments`;
  const key = `${storageKey}:comments:${itemId}`;
  const load = useCallback(async (signal?: AbortSignal) => {
    const data = demo ? { comments: JSON.parse(localStorage.getItem(key) ?? "[]") as BucketComment[] } : await apiRequest<{ comments: BucketComment[] }>(url, { signal });
    if (!signal?.aborted) { setComments(data.comments); setLoaded(true); }
  }, [demo, key, url]);
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => { void load(controller.signal).catch(error => { if (!controller.signal.aborted) setError(error.message); }); }, 0); return () => { clearTimeout(timer); controller.abort(); }; }, [load]);
  async function write(id?: string) {
    if (lock.current || (!id && !body.trim())) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (demo) {
        const next = id ? comments.filter(c => c.id !== id) : [...comments, { id: requestId.current, bucket_id: itemId, author_id: viewerId, body: body.trim(), created_at: new Date().toISOString(), profiles: { display_name: viewerName } }];
        localStorage.setItem(key, JSON.stringify(next)); setComments(next);
      } else {
        await apiRequest(url, jsonRequest(id ? "DELETE" : "POST", { id: id ?? requestId.current, body }));
      }
      if (!id) { setBody(""); requestId.current = crypto.randomUUID(); }
      if (!demo) await load();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); lock.current = false; }
  }
  return <section className="bucket-comments" aria-label="버킷리스트 댓글"><div className="bucket-actions"><h3>댓글 {comments.length}</h3><Button variant="ghost" disabled={busy} onClick={() => void load().then(() => setError("")).catch(error => setError(error.message))}>새로고침</Button></div>{comments.map(comment => <article key={comment.id}><strong>{comment.profiles?.display_name ?? "멤버"}</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString("ko-KR")}</time><p>{comment.body}</p>{comment.author_id === viewerId && <Button variant="ghost" disabled={busy} onClick={() => void write(comment.id)}>댓글 삭제</Button>}</article>)}<label>댓글 남기기<Textarea maxLength={1000} value={body} onChange={event => { setBody(event.target.value); requestId.current = crypto.randomUUID(); }} disabled={busy} placeholder="이곳에 가고 싶은 이유나 함께할 이야기를 남겨주세요." /></label><Button disabled={busy || !loaded || !body.trim()} onClick={() => void write()}>댓글 등록</Button>{error && <p role="alert">{error}</p>}</section>;
}
