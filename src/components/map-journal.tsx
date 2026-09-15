"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Camera, ChevronDown, Filter, List, LocateFixed, LogOut, Map as MapIcon, MapPin, Menu, MoreHorizontal, Plus, Search, Star, Users, X } from "lucide-react";
import { KakaoMap } from "@/components/kakao-map";
import { GroupOnboarding } from "@/components/group-onboarding";
import { InstallAppButton } from "@/components/install-app-button";
import { prepareVisitImage } from "@/lib/images";
import { visitSchema } from "@/lib/schemas";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { DashboardData } from "@/lib/data";
import type { Group, KakaoPlaceResult, Place, Visit } from "@/types/domain";

const formatDate = (date: string) => new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", weekday: "short" }).format(new Date(`${date}T12:00:00`));
const VISITS_STORAGE_KEY = "place-memory-visits-v2";
const GROUPS_STORAGE_KEY = "place-memory-groups-v1";

export function MapJournal({ initialData, viewerName }: { initialData: DashboardData; viewerName?: string }) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialData.groups);
  const [activeGroupId, setActiveGroupId] = useState(initialData.groups[0]?.id ?? "");
  const [visits, setVisits] = useState(initialData.visits);
  const [storageReady, setStorageReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(initialData.visits[0]?.id);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KakaoPlaceResult[]>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [tag, setTag] = useState("전체");
  const [mobileList, setMobileList] = useState(false);
  const [draftPlace, setDraftPlace] = useState<Place | null>(null);
  const [editing, setEditing] = useState<Visit | null>(null);
  const [notice, setNotice] = useState(initialData.demoMode ? "간편 코드 로그인 모드입니다. 이 브라우저에서 기록을 정리할 수 있어요." : "");
  const [groupMenu, setGroupMenu] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number }>();
  const [selectedDateKey, setSelectedDateKey] = useState<string | undefined>(initialData.visits[0]?.visitedOn);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const groupDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(VISITS_STORAGE_KEY);
        const savedGroups = window.localStorage.getItem(GROUPS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Visit[];
          if (Array.isArray(parsed)) setVisits(parsed);
        }
        if (savedGroups) {
          const parsedGroups = JSON.parse(savedGroups) as Group[];
          if (Array.isArray(parsedGroups) && parsedGroups.length) {
            setGroups(parsedGroups);
            setActiveGroupId(parsedGroups[0].id);
          }
        }
      } catch {
        setNotice("저장된 기록을 불러오지 못했습니다.");
      } finally {
        setStorageReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(VISITS_STORAGE_KEY, JSON.stringify(visits));
    window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  }, [groups, storageReady, visits]);

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0];
  const groupVisits = useMemo(() => visits.filter((visit) => visit.groupId === activeGroupId && (tag === "전체" || visit.tags.includes(tag))), [activeGroupId, tag, visits]);
  const dateGroups = useMemo(() => {
    const grouped = new Map<string, Visit[]>();
    [...groupVisits].sort((a, b) => b.visitedOn.localeCompare(a.visitedOn)).forEach((visit) => grouped.set(visit.visitedOn, [...(grouped.get(visit.visitedOn) ?? []), visit]));
    return Array.from(grouped, ([date, dateVisits]) => ({ date, visits: dateVisits }));
  }, [groupVisits]);
  const highlightedIds = useMemo(() => dateGroups.find((group) => group.date === selectedDateKey)?.visits.map((visit) => visit.id) ?? [], [dateGroups, selectedDateKey]);
  const allTags = useMemo(() => ["전체", ...Array.from(new Set(visits.flatMap((visit) => visit.tags))).slice(0, 4)], [visits]);
  const selected = visits.find((visit) => visit.id === selectedId);

  function openForPlace(place: Place) {
    setDraftPlace(place); setEditing(null); setManualMode(false); setSearchResults([]); dialogRef.current?.showModal();
  }
  function openEdit(visit: Visit) { setDraftPlace(visit.place); setEditing(visit); dialogRef.current?.showModal(); }

  async function searchPlaces(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return setSearchMessage("두 글자 이상 입력해 주세요.");
    setSearching(true); setSearchMessage("");
    try {
      const response = await fetch(`/api/places/search?q=${encodeURIComponent(query.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSearchResults(data.results);
      if (!data.results.length) setSearchMessage("검색 결과가 없어요. 지도에 직접 핀을 찍어보세요.");
    } catch (error) {
      const local = visits.filter((visit) => visit.place.name.includes(query.trim())).map((visit) => ({ id: visit.place.providerPlaceId ?? visit.place.id, placeName: visit.place.name, addressName: visit.place.address, roadAddressName: visit.place.address, categoryName: visit.place.category, latitude: visit.place.latitude, longitude: visit.place.longitude }));
      setSearchResults(local);
      setSearchMessage(local.length ? "현재 기록에서 찾았습니다." : error instanceof Error ? error.message : "장소를 찾지 못했습니다.");
    } finally { setSearching(false); }
  }

  function manualPoint(latitude: number, longitude: number) {
    openForPlace({ id: crypto.randomUUID(), provider: "manual", name: "", address: "", category: "직접 지정", latitude, longitude });
  }

  async function saveVisit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftPlace || !activeGroup) return;
    const form = new FormData(event.currentTarget);
    const files = form.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0).slice(0, 5);
    const participantIds = initialData.members.filter((member) => form.get(`member-${member.id}`) === "on").map((member) => member.id);
    const raw = { id: editing?.id, groupId: activeGroup.id, place: { ...draftPlace, name: String(form.get("placeName") ?? draftPlace.name), address: String(form.get("address") ?? draftPlace.address) }, visitedOn: String(form.get("visitedOn")), title: String(form.get("title")), note: String(form.get("note")), rating: Number(form.get("rating")), tags: String(form.get("tags") ?? "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8), participantIds, version: editing?.version ?? 1 };
    const parsed = visitSchema.safeParse(raw);
    if (!parsed.success) return setNotice(parsed.error.issues[0]?.message ?? "입력을 확인해 주세요.");

    let id = editing?.id ?? crypto.randomUUID(); let version = editing?.version ?? 1; let photoUrls = editing?.photoUrls ?? [];
    try {
      if (!initialData.demoMode) {
        const response = await fetch("/api/visits", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        id = data.id; version = data.version;
        if (files.length) {
          const supabase = createSupabaseBrowserClient();
          const prepared = await Promise.all(files.map(prepareVisitImage));
          for (const [index, file] of prepared.entries()) {
            const path = `${activeGroup.id}/${id}/${file.name}`;
            const { error } = await supabase.storage.from("visit-photos").upload(path, file, { contentType: "image/webp" });
            if (error) throw error;
            await supabase.from("visit_photos").insert({ visit_id: id, storage_path: path, sort_order: index });
          }
        }
      } else if (files.length) photoUrls = files.map((file) => URL.createObjectURL(file));

      const nextVisit: Visit = { id, groupId: activeGroup.id, place: parsed.data.place as Place, visitedOn: parsed.data.visitedOn, title: parsed.data.title, note: parsed.data.note, rating: parsed.data.rating, tags: parsed.data.tags, participants: initialData.members.filter((member) => participantIds.includes(member.id)), photoUrls, version, updatedBy: initialData.members[0]?.displayName ?? "나" };
    setVisits((current) => editing ? current.map((visit) => visit.id === editing.id ? nextVisit : visit) : [nextVisit, ...current]);
      setSelectedId(id); setSelectedDateKey(parsed.data.visitedOn); setNotice(editing ? "기록을 고쳤습니다." : "새로운 기억을 지도에 남겼습니다."); dialogRef.current?.close();
    } catch (error) { setNotice(error instanceof Error ? error.message : "기록을 저장하지 못했습니다."); }
  }

  function deleteVisit(visit: Visit) {
    if (!window.confirm(`“${visit.place.name}” 방문 기록을 삭제할까요?`)) return;
    setVisits((current) => current.filter((item) => item.id !== visit.id));
    setSelectedId(undefined);
    setSelectedDateKey(undefined);
    setNotice("방문 기록을 삭제했습니다.");
  }

  function openCreateGroup() {
    setGroupPickerOpen(false);
    setNewGroupName("");
    groupDialogRef.current?.showModal();
  }

  function createGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newGroupName.trim();
    if (name.length < 2) return setNotice("지도 이름을 두 글자 이상 입력해 주세요.");
    const group: Group = { id: crypto.randomUUID(), name, role: "owner", memberCount: 4 };
    setGroups((current) => [...current, group]);
    setActiveGroupId(group.id);
    setSelectedId(undefined);
    setSelectedDateKey(undefined);
    setNotice(`“${name}” 지도를 만들었습니다.`);
    groupDialogRef.current?.close();
  }

  async function createInvite() {
    if (!activeGroup || initialData.demoMode) return setNotice("실제 계정을 연결하면 초대 링크를 만들 수 있어요.");
    const response = await fetch("/api/groups/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: activeGroup.id }) });
    const data = await response.json();
    if (!response.ok) return setNotice(data.error);
    setInviteLink(data.url); await navigator.clipboard.writeText(data.url); setNotice("7일 동안 유효한 초대 링크를 복사했습니다.");
  }

  async function logout() {
    await fetch("/api/access/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  function locateMe() {
    if (!navigator.geolocation) return setNotice("이 브라우저에서는 현재 위치를 사용할 수 없습니다.");
    setNotice("현재 위치를 찾고 있습니다…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setCurrentLocation({ latitude: coords.latitude, longitude: coords.longitude }); setNotice("현재 위치로 지도를 옮겼습니다."); },
      () => setNotice("위치 권한을 확인한 뒤 다시 시도해 주세요."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  if (!groups.length) return <GroupOnboarding />;

  return (
    <main className="journal-app">
      <aside className={`journal-sidebar ${mobileList ? "mobile-open" : ""}`}>
        <header className="sidebar-header"><div className="wordmark"><span className="wordmark-pin"><MapPin size={17} fill="currentColor" /></span><span>PLACE<br />MEMORY MAP</span></div><button className="icon-button mobile-close" onClick={() => setMobileList(false)} aria-label="목록 닫기"><X size={20} /></button></header>
        <div className="group-row"><label id="group-label">함께 보는 지도</label><div className="group-picker"><button className="group-picker-trigger" type="button" aria-labelledby="group-label" aria-haspopup="listbox" aria-expanded={groupPickerOpen} onClick={() => setGroupPickerOpen((value) => !value)}><span>{activeGroup?.name ?? "지도 선택"}</span><ChevronDown size={17} /></button>{groupPickerOpen && <div className="group-picker-menu" role="listbox" aria-label="함께 보는 지도 선택">{groups.filter((group) => group.id !== activeGroupId).map((group) => <button key={group.id} className="group-picker-option" type="button" role="option" aria-selected={false} onClick={() => { setActiveGroupId(group.id); setSelectedId(undefined); setSelectedDateKey(undefined); setGroupPickerOpen(false); }}>{group.name}<span>{group.memberCount}명</span></button>)}<button className="group-picker-add" type="button" onClick={openCreateGroup}><Plus size={15} />함께 보는 지도 추가</button></div>}</div><span>{activeGroup?.memberCount ?? 0}명</span></div>
        <form className="place-search" onSubmit={searchPlaces}><Search size={19} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="장소 이름으로 찾기" aria-label="장소 검색" /><button type="submit" disabled={searching}>{searching ? "…" : "찾기"}</button></form>
        {(searchResults.length > 0 || searchMessage) && <div className="search-popover">{searchResults.map((result) => <button key={result.id} onClick={() => openForPlace({ id: crypto.randomUUID(), provider: "kakao", providerPlaceId: result.id, name: result.placeName, address: result.roadAddressName || result.addressName, category: result.categoryName, latitude: result.latitude, longitude: result.longitude })}><strong>{result.placeName}</strong><span>{result.roadAddressName || result.addressName}</span></button>)}{searchMessage && <p>{searchMessage}</p>}</div>}
        <div className="filter-row" aria-label="기록 필터"><Filter size={15} />{allTags.map((item) => <button key={item} className={tag === item ? "active" : ""} onClick={() => setTag(item)}>{item}</button>)}</div>
        <div className="record-heading"><div><h1>우리의 발자국</h1><p>{groupVisits.length}개의 방문 기록</p></div><button className="icon-button" aria-label="더보기"><MoreHorizontal size={20} /></button></div>
        <div className="record-list">
          {!groupVisits.length && <div className="empty-records"><MapPin size={24} /><strong>아직 남긴 발자국이 없어요.</strong><span>장소를 찾거나 지도에 핀을 찍어보세요.</span></div>}
          {dateGroups.map(({ date, visits: dateVisits }) => {
            const active = selectedDateKey === date;
            return <section key={date} className={`date-group ${active ? "active" : ""}`}>
              <button className="date-group-toggle" aria-expanded={active} aria-label={`${formatDate(date)} 방문 기록 ${dateVisits.length}개 ${active ? "접기" : "펼치기"}`} onClick={() => { setSelectedDateKey(active ? undefined : date); if (!active && dateVisits[0]) setSelectedId(dateVisits[0].id); }}><span><CalendarDays size={15} /><time>{formatDate(date)}</time></span><strong>{dateVisits.length}곳 <ChevronDown size={15} /></strong></button>
              {active && <div className="date-group-items">{dateVisits.map((visit) => <button key={visit.id} className={`record-item ${selectedId === visit.id ? "selected" : ""}`} onClick={() => { setSelectedId(visit.id); setMobileList(false); }}><span className="record-index">{String(groupVisits.indexOf(visit) + 1).padStart(2, "0")}</span><div><strong>{visit.place.name}</strong><p>{visit.title}</p><div className="mini-meta"><span><Star size={13} fill="currentColor" /> {visit.rating}.0</span><span><Users size={13} /> {visit.participants.length}</span>{visit.photoUrls.length > 0 && <span><Camera size={13} /> {visit.photoUrls.length}</span>}</div></div></button>)}</div>}
            </section>;
          })}
        </div>
        <footer className="sidebar-footer"><span className="avatar">{(viewerName ?? initialData.members[0]?.displayName ?? "여행자").slice(0, 1)}</span><div><strong>{viewerName ?? initialData.members[0]?.displayName ?? "여행자"}</strong><span>{initialData.demoMode ? "간편 로그인" : "로그인됨"}</span></div><button className="icon-button" aria-label="그룹 메뉴" onClick={() => setGroupMenu((value) => !value)}><Menu size={19} /></button>{groupMenu && <div className="group-menu"><strong>{activeGroup?.name}</strong><span>구성원 {activeGroup?.memberCount}명 · {activeGroup?.role === "owner" ? "그룹장" : "멤버"}</span>{activeGroup?.role === "owner" && <button onClick={createInvite}>초대 링크 만들기</button>}{inviteLink && <input value={inviteLink} readOnly aria-label="초대 링크" />}<InstallAppButton /><button className="group-menu-logout" onClick={logout}><LogOut size={15} />로그아웃</button></div>}</footer>
      </aside>

      <section className="map-stage">
        <KakaoMap visits={groupVisits} selectedId={selectedId} highlightedIds={highlightedIds} manualMode={manualMode} onSelect={(visit) => setSelectedId(visit.id)} onManualPoint={manualPoint} focusLocation={currentLocation} />
        <div className="map-topbar"><button className="icon-button mobile-list-button" onClick={() => setMobileList(true)} aria-label="기록 목록 열기"><List size={20} /></button><div className="map-date"><CalendarDays size={16} /><span>2026년의 기록</span></div><button className="location-button" onClick={locateMe}><LocateFixed size={17} />내 위치</button></div>
        <button className={`add-pin-button ${manualMode ? "active" : ""}`} aria-label={manualMode ? "핀 추가 취소" : "지도에 핀 추가"} onClick={() => setManualMode((value) => !value)}><Plus size={19} /><span>{manualMode ? "핀 추가 취소" : "지도에 핀 추가"}</span></button>
        {selected && <article className="place-sheet"><button className="sheet-close" onClick={() => setSelectedId(undefined)} aria-label="상세 닫기"><X size={18} /></button>{selected.photoUrls[0] && <div className="sheet-photo"><img src={selected.photoUrls[0]} alt={`${selected.place.name} 방문 사진`} /><span>방문 사진</span></div>}<div className="sheet-content"><div className="sheet-date"><span>{formatDate(selected.visitedOn)}</span><span>{selected.place.category}</span></div><h2>{selected.place.name}</h2><p className="sheet-address"><MapPin size={15} />{selected.place.address || "직접 지정한 위치"}</p><h3>{selected.title}</h3><p className="sheet-note">{selected.note}</p><div className="sheet-tags">{selected.tags.map((item) => <span key={item}>#{item}</span>)}</div><div className="sheet-footer"><div className="participants">{selected.participants.map((person) => <span key={person.id} title={person.displayName}>{person.initials}</span>)}<small>함께</small></div><div className="sheet-actions"><button onClick={() => openEdit(selected)}>기록 고치기</button><button className="danger-button" onClick={() => deleteVisit(selected)}>기록 삭제</button></div></div></div></article>}
        {notice && <button className="notice" onClick={() => setNotice("")} aria-live="polite">{notice}<X size={14} /></button>}
        <nav className="mobile-nav" aria-label="모바일 주요 메뉴"><button className="active"><MapIcon size={20} />지도</button><button onClick={() => setMobileList(true)}><List size={20} />기록</button><button onClick={() => setManualMode(true)}><Plus size={22} />추가</button><button><Users size={20} />그룹</button></nav>
      </section>

      <dialog ref={dialogRef} className="visit-dialog" onClose={() => { setDraftPlace(null); setEditing(null); }}>
        <form method="dialog" className="dialog-close-form"><button aria-label="창 닫기"><X size={20} /></button></form>
        {draftPlace && <form className="visit-form" onSubmit={saveVisit}><div className="form-title"><MapPin size={22} /><div><span>{editing ? "기록 고치기" : "새 방문 기록"}</span><h2>{draftPlace.name || "이 위치에 이름을 붙여주세요"}</h2></div></div><div className="form-grid"><label>장소 이름<input name="placeName" defaultValue={draftPlace.name} required /></label><label>방문한 날<input name="visitedOn" type="date" defaultValue={editing?.visitedOn ?? new Date().toISOString().slice(0, 10)} required /></label></div><label>주소 또는 위치 설명<input name="address" defaultValue={draftPlace.address} placeholder="예: 해방촌 골목 안쪽" /></label><label>기록 제목<input name="title" defaultValue={editing?.title} placeholder="그날을 한 문장으로" required /></label><label>무엇을 했나요?<textarea name="note" defaultValue={editing?.note} rows={4} placeholder="먹은 것, 나눈 이야기, 다시 오고 싶은 이유…" /></label><div className="form-grid"><label>별점<select name="rating" defaultValue={editing?.rating ?? 5}>{[5,4,3,2,1].map((value) => <option key={value} value={value}>{"★".repeat(value)} {value}.0</option>)}</select></label><label>태그<input name="tags" defaultValue={editing?.tags.join(", ")} placeholder="데이트, 산책, 맛집" /></label></div><fieldset><legend>함께한 사람</legend><div className="member-checks">{initialData.members.map((member) => <label key={member.id}><input type="checkbox" name={`member-${member.id}`} defaultChecked={editing ? editing.participants.some((person) => person.id === member.id) : true} /><span>{member.initials}</span>{member.displayName}</label>)}</div></fieldset><label className="photo-input"><Camera size={20} /><span><strong>사진 추가</strong><small>최대 5장 · 업로드 전 자동 압축</small></span><input name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple /></label><div className="form-actions"><button type="button" onClick={() => dialogRef.current?.close()}>취소</button><button className="primary-button" type="submit">{editing ? "수정 내용 저장" : "지도에 기록 남기기"}</button></div></form>}
      </dialog>
      <dialog ref={groupDialogRef} className="group-dialog" onClose={() => setNewGroupName("")}>
        <form className="group-create-form" onSubmit={createGroup}>
          <div className="form-title"><MapIcon size={21} /><div><span>새 지도 만들기</span><h2>함께 볼 지도의 이름</h2></div></div>
          <label htmlFor="new-group-name">지도 이름<input id="new-group-name" value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="예: 제주도 여름 기록" maxLength={40} autoFocus required /></label>
          <p className="form-message">새 지도는 네 명이 함께 기록할 수 있어요.</p>
          <div className="form-actions"><button type="button" onClick={() => groupDialogRef.current?.close()}>취소</button><button className="primary-button" type="submit">지도 만들기</button></div>
        </form>
      </dialog>
    </main>
  );
}
