"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Download, MapPin, Plus, Search, X } from "lucide-react";
import { KakaoMap } from "@/components/kakao-map";
import { TimetableGrid } from "@/components/timetable-grid";
import { addMinutes, daySegments, scheduleSchema, tripDates, tripSchema } from "@/lib/timetable";
import { tripRequest, useTripStore } from "@/lib/use-trip-store";
import { DEFAULT_MARKER_STYLE, normalizeMarkerStyle } from "@/lib/marker-styles";
import { Button } from "@/components/ui/button";
import type { Group, KakaoPlaceResult, MapPoint, Place, ScheduleItem, Trip, TripRoute, Visit } from "@/types/domain";

interface Draft { id?: string; version: number; startsAt: string; endsAt: string; title: string; note: string; place?: Place; newPlace: boolean; markerStyle: ScheduleItem["markerStyle"] }
const zoneOptions = ["Asia/Seoul", "Asia/Tokyo", "Asia/Shanghai", "Asia/Taipei", "Asia/Bangkok", "Asia/Singapore", "Asia/Dubai", "Europe/Paris", "Europe/London", "Europe/Rome", "America/New_York", "America/Los_Angeles", "Pacific/Honolulu", "Australia/Sydney"];

export function TripPlanner({ groupId, groups, visits, demo, initialVisit, onGroup, onClose }: {
  groupId: string; groups: Group[]; visits: Visit[]; demo: boolean; initialVisit?: Visit; onGroup: (id: string) => void; onClose: () => void;
}) {
  const store = useTripStore(groupId, demo);
  const [tripId, setTripId] = useState("");
  const trip = store.trips.find((value) => value.id === tripId) ?? store.trips[0];
  const [chosenDate, setChosenDate] = useState("");
  const date = trip && chosenDate >= trip.startDate && chosenDate <= trip.endDate ? chosenDate : trip?.startDate ?? "";
  const [selectedId, setSelectedId] = useState<string>();
  const [tab, setTab] = useState<"time" | "map">("time");
  const [provider, setProvider] = useState<"kakao" | "osm">("kakao");
  const [draft, setDraft] = useState<Draft>();
  const [tripDraft, setTripDraft] = useState<(Omit<Trip, "id"> & { id?: string })>();
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const busy = store.busy || exporting;
  const mapExportRef = useRef<HTMLDivElement>(null);
  const [formError, setFormError] = useState("");
  const [source, setSource] = useState<"search" | "records">("search");
  const [query, setQuery] = useState("");
  const [plannedOnly, setPlannedOnly] = useState(false);
  const [results, setResults] = useState<KakaoPlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchEpoch = useRef(0);
  const [manual, setManual] = useState(false);
  const [carryVisit, setCarryVisit] = useState(initialVisit);
  const [savedRoute, setSavedRoute] = useState<{ key: string; route: TripRoute }>();
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeFeedback, setRouteFeedback] = useState<{ key: string; notice: string }>();
  const itemDialog = useRef<HTMLDialogElement>(null);
  const tripDialog = useRef<HTMLDialogElement>(null);
  const items = useMemo(() => store.items.filter((item) => item.tripId === trip?.id), [store.items, trip?.id]);
  const selected = items.find((item) => item.id === selectedId);
  const today = daySegments(items, date || "2000-01-01");
  const pins = useMemo(() => {
    const grouped = new Map<string, MapPoint & { items: ScheduleItem[] }>();
    for (const segment of daySegments(items, date || "2000-01-01")) {
      const item = segment.item;
      const coordinate = `${item.place.latitude.toFixed(6)},${item.place.longitude.toFixed(6)}`;
      const previous = grouped.get(coordinate);
      if (previous) { previous.items.push(item); previous.pinLabel += ` · ${segment.order}`; previous.pinNumber += `,${segment.order}`; }
      else grouped.set(coordinate, { id: item.id, place: item.place, markerStyle: item.markerStyle, items: [item], pinLabel: `${segment.order} · ${item.startsAt.slice(11)}`, pinNumber: `${segment.order}` });
    }
    return [...grouped.values()];
  }, [items, date]);
  const selectedPin = pins.find((pin) => pin.items.some((item) => item.id === selectedId));
  const [pinChoices, setPinChoices] = useState<string[]>([]);
  const routeKey = `${trip?.id ?? ""}|${date}|${provider}|${pins.map((pin) => `${pin.items.map((item) => item.id).sort().join(",")}@${pin.place.latitude.toFixed(6)},${pin.place.longitude.toFixed(6)}`).join("|")}`;
  const visibleRoute = savedRoute?.key === routeKey ? savedRoute.route : null;
  const routeNotice = routeFeedback?.key === routeKey ? routeFeedback.notice : "";

  useEffect(() => { if (draft && !manual && !itemDialog.current?.open) itemDialog.current?.showModal(); }, [draft, manual]);
  useEffect(() => { if (tripDraft && !tripDialog.current?.open) tripDialog.current?.showModal(); }, [tripDraft]);
  function clearItem() { setDraft(undefined); setManual(false); setFormError(""); searchEpoch.current++; setSearching(false); itemDialog.current?.close(); }
  function chooseDate(next: string) { setChosenDate(next); setPinChoices([]); }
  function chooseTrip(id: string) { setTripId(id); setChosenDate(""); setSelectedId(undefined); setPinChoices([]); }
  function chooseItem(item: ScheduleItem, fromMap = false) {
    setSelectedId(item.id);
    if (!today.some((segment) => segment.item.id === item.id)) setChosenDate(item.startsAt.slice(0, 10));
    if (fromMap) setTab("time");
  }
  function createDraft(start = `${date}T09:00`, end = addMinutes(start, 60)) {
    setFormError(""); setQuery(""); setResults([]); setSource("search");
    setDraft({ startsAt: start, endsAt: end, title: carryVisit?.place.name ?? "", note: "", place: carryVisit?.place, newPlace: false, markerStyle: carryVisit?.markerStyle ?? DEFAULT_MARKER_STYLE, version: 1 });
  }
  function editItem(item: ScheduleItem) { setFormError(""); setQuery(""); setResults([]); setDraft({ ...item, newPlace: false }); }
  function openTrip(current?: Trip) {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    setFormError(""); setTripDraft(current ? { ...current } : { groupId, name: "", startDate: today, endDate: today, timeZone: "Asia/Seoul", version: 1 });
  }
  async function saveTrip(event: React.FormEvent) {
    event.preventDefault(); if (!tripDraft) return;
    const parsed = tripSchema.safeParse(tripDraft);
    if (!parsed.success) return setFormError(parsed.error.issues[0].message);
    try { const id = await store.saveTrip(parsed.data); if (id) chooseTrip(id); tripDialog.current?.close(); setTripDraft(undefined); setMessage("여행 시간표를 저장했어요."); }
    catch (error) { setFormError((error as Error).message); }
  }
  async function saveItem(event: React.FormEvent) {
    event.preventDefault(); if (!draft || !trip) return;
    if (!draft.place) return setFormError("일정에 넣을 장소를 선택해 주세요.");
    const parsed = scheduleSchema.safeParse({ ...draft, title: draft.title || draft.place.name });
    if (!parsed.success) return setFormError(parsed.error.issues[0].message);
    try {
      await store.saveItem(trip, { ...parsed.data, groupId, tripId: trip.id, place: draft.place }, draft.newPlace);
      setChosenDate(draft.startsAt.slice(0, 10)); clearItem(); setCarryVisit(undefined); setMessage("일정을 저장했어요.");
    } catch (error) { setFormError((error as Error).message); }
  }
  async function changeItem(item: ScheduleItem) {
    if (!trip) return;
    try { await store.saveItem(trip, item); chooseItem(item); setMessage("일정 시간을 변경했어요."); }
    catch (error) { setMessage((error as Error).message); }
  }
  async function searchPlaces(event: React.FormEvent) {
    event.preventDefault(); if (query.trim().length < 2) return setFormError("두 글자 이상 입력해 주세요.");
    const epoch = ++searchEpoch.current; setSearching(true); setFormError("");
    try { const data = await tripRequest(`/api/places/search?q=${encodeURIComponent(query.trim())}&map=${provider}`); if (epoch === searchEpoch.current) { setResults(data.results); if (!data.results.length) setFormError("검색 결과가 없어요. 지도에서 직접 선택해 주세요."); } }
    catch (error) { if (epoch === searchEpoch.current) setFormError(`${(error as Error).message} 지도에서 직접 선택할 수도 있어요.`); }
    finally { if (epoch === searchEpoch.current) setSearching(false); }
  }
  function pickPlace(place: Place, newPlace: boolean, markerStyle = draft?.markerStyle ?? DEFAULT_MARKER_STYLE) {
    setDraft((current) => current ? { ...current, place, newPlace, markerStyle, title: current.title || place.name } : current); setResults([]); setFormError("");
  }
  function manualPoint(latitude: number, longitude: number) {
    pickPlace({ id: crypto.randomUUID(), provider: "manual", name: "직접 선택한 장소", address: "", category: "직접 지정", latitude, longitude }, true); setManual(false);
  }
  const records = visits.filter((visit) => visit.groupId === groupId && (!plannedOnly || visit.isPlanned) && `${visit.place.name} ${visit.title}`.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 3600);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (!trip || pins.length < 2) return;
    let cancelled = false;
    const key = routeKey;
    if (demo) {
      let frame = 0;
      try {
        const cached = localStorage.getItem(`place-memory-trip-route:${key}`);
        const route = cached ? JSON.parse(cached) as TripRoute : null;
        if (route) frame = window.requestAnimationFrame(() => { if (!cancelled) setSavedRoute({ key, route }); });
      } catch { /* A malformed local demo cache is ignored. */ }
      return () => { cancelled = true; if (frame) window.cancelAnimationFrame(frame); };
    }
    fetch(`/api/trips/${trip.id}/route?date=${encodeURIComponent(date)}&provider=${provider}`)
      .then(async (response) => response.ok ? response.json() as Promise<{ route?: TripRoute | null }> : null)
      .then((data) => { if (!cancelled && data?.route) setSavedRoute({ key, route: data.route }); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [date, demo, pins.length, provider, routeKey, trip]);

  async function showRoute() {
    if (!trip || pins.length < 2 || routeBusy) return;
    const key = routeKey;
    setRouteBusy(true);
    setRouteFeedback({ key, notice: "" });
    try {
      if (demo) {
        const route: TripRoute = { kind: "straight", points: pins.map((pin) => ({ latitude: pin.place.latitude, longitude: pin.place.longitude })) };
        localStorage.setItem(`place-memory-trip-route:${key}`, JSON.stringify(route));
        setSavedRoute({ key, route });
        setRouteFeedback({ key, notice: "데모 지도에서는 장소 순서대로 연결해요." });
        return;
      }
      const response = await fetch(`/api/trips/${trip.id}/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, provider }),
      });
      const data = await response.json() as { route?: TripRoute; notice?: string; error?: string };
      if (!response.ok || !data.route) throw new Error(data.error || "동선을 불러오지 못했습니다.");
      setSavedRoute({ key, route: data.route });
      setRouteFeedback({ key, notice: data.notice || "" });
    } catch (error) {
      setRouteFeedback({ key, notice: (error as Error).message });
    } finally { setRouteBusy(false); }
  }

  async function exportExcel() {
    if (!trip || exporting) return;
    setExporting(true);
    try {
      const [{ downloadTripExcel }, { captureTripMap }] = await Promise.all([import("@/lib/trip-export"), import("@/lib/trip-map-export")]);
      const { image, fallback } = await captureTripMap(mapExportRef.current, pins, date, visibleRoute);
      await downloadTripExcel(trip, items, date, provider, image);
      setMessage(fallback ? "엑셀을 저장했어요. 지도 배경을 가져올 수 없어 장소 위치도와 지도 링크를 넣었어요." : "전체 여행 계획과 선택한 날짜의 지도를 엑셀로 저장했어요.");
    } catch {
      setMessage("엑셀을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally { setExporting(false); }
  }

  return <section className={`trip-planner ${manual ? "is-manual" : ""}`} aria-label="여행 계획">
    <header className="planner-header">
      <button className="planner-back" onClick={onClose} disabled={busy}><ArrowLeft size={18} />기록</button>
      <h1>여행 계획</h1>
      <label className="planner-group">함께 보는 지도<select aria-label="여행 계획 지도" value={groupId} disabled={busy} onChange={(event) => onGroup(event.target.value)}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      {trip && store.trips.length > 1 && <label className="planner-trip-choice">여행<select aria-label="여행 선택" value={trip.id} disabled={busy} onChange={(event) => chooseTrip(event.target.value)}>{store.trips.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>}
      {trip && store.trips.length === 1 && <span className="planner-trip-choice planner-trip-name">{trip.name}<small>{trip.startDate} – {trip.endDate} · {trip.timeZone}</small></span>}
      {trip && <div className="planner-header-actions"><Button variant="outline" size="sm" className="planner-export" onClick={() => void exportExcel()} disabled={busy || routeBusy || manual} aria-label="엑셀 다운로드" aria-busy={exporting} title="전체 여행 계획과 선택한 날짜의 지도 저장"><Download size={16} />{exporting ? "저장 중…" : <>엑셀<span className="planner-export-label"> 다운로드</span></>}</Button><Button variant="outline" size="sm" onClick={() => openTrip(trip)} disabled={busy}>여행 설정</Button><Button variant="secondary" size="sm" className="planner-new-trip" onClick={() => openTrip()} disabled={!store.ready || busy}>새 여행</Button><Button size="sm" className="primary-button" onClick={() => createDraft()} disabled={busy}><Plus size={17} />일정 추가</Button></div>}
      {!trip && <button className="primary-button planner-new-empty" onClick={() => openTrip()} disabled={!store.ready || busy}><Plus size={17} />새 여행</button>}
    </header>
    {(message || store.error) && <div className={`planner-message ${store.error ? "has-error" : ""}`} role={store.error ? "alert" : "status"}>{store.error || message}<button aria-label="안내 닫기" onClick={() => setMessage("")}><X size={16} /></button>{store.error && <button onClick={() => void store.refresh().catch((error) => setMessage(error.message))}>다시 불러오기</button>}</div>}
    {!store.ready ? <p className="planner-empty">여행을 불러오는 중…</p> : !trip ? <div className="planner-empty"><CalendarDays size={40} /><h2>함께 갈 곳, 시간표로 모아보세요.</h2><p>여행 기간을 정하고 빈 시간을 드래그하면<br />장소와 일정이 지도에 함께 남아요.</p>{carryVisit && <p>선택한 장소: {carryVisit.place.name}</p>}<button className="primary-button" onClick={() => openTrip()}>첫 여행 만들기</button></div> : <>
      {carryVisit && <div className="planner-carry">{carryVisit.place.name}을 넣을 시간을 선택해 주세요.<button onClick={() => setCarryVisit(undefined)}>선택 취소</button></div>}
      <div className="planner-datebar"><strong className="planner-day-title">{date && new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`))}</strong><div className="planner-date-choice"><button aria-label="이전 날짜" disabled={busy || date <= trip.startDate} onClick={() => chooseDate(addMinutes(`${date}T00:00`, -1440).slice(0, 10))}><ChevronLeft size={17} /></button><label>날짜<input aria-label="계획 날짜" disabled={busy} type="date" min={trip.startDate} max={trip.endDate} value={date} onChange={(event) => { if (tripDates(trip).includes(event.target.value)) chooseDate(event.target.value); }} /></label><button aria-label="다음 날짜" disabled={busy || date >= trip.endDate} onClick={() => chooseDate(addMinutes(`${date}T00:00`, 1440).slice(0, 10))}><ChevronRight size={17} /></button></div><span className="planner-drag-hint">시간표를 드래그해 일정 추가</span><div className="planner-mobile-tabs" role="group" aria-label="계획 보기"><button disabled={busy} aria-pressed={tab === "time"} onClick={() => setTab("time")}>시간표</button><button disabled={busy} aria-pressed={tab === "map"} onClick={() => setTab("map")}>지도</button></div></div>
      <div className={`planner-workspace view-${tab}`}>
        <div className="planner-time-panel"><TimetableGrid trip={trip} items={items} date={date} selectedId={selectedId} active={tab === "time"} disabled={busy} onDate={chooseDate} onSelect={chooseItem} onCreate={createDraft} onChange={(item) => void changeItem(item)} />
          {selected && <div className="planner-selection"><div><strong>{selected.title}</strong><span>{selected.startsAt.slice(5).replace("T", " ")} – {selected.endsAt.slice(0, 10) === selected.startsAt.slice(0, 10) ? selected.endsAt.slice(11) : selected.endsAt.slice(5).replace("T", " ")}</span><span>{selected.place.name}</span>{selected.note && <p>{selected.note}</p>}</div><button disabled={busy} onClick={() => { chooseDate(date); setTab("map"); }}>지도 보기</button><button disabled={busy} onClick={() => editItem(selected)}>일정 수정</button><button aria-label="일정 선택 닫기" onClick={() => setSelectedId(undefined)}><X size={16} /></button></div>}
        </div>
        <div className="planner-map-panel">{manual && <div className="planner-manual-banner">일정 장소를 지도에서 선택하세요.<button onClick={() => setManual(false)}>취소하고 돌아가기</button></div>}<div className="planner-map-canvas" ref={mapExportRef}>
          <KakaoMap key={`${provider}-${tab}`} visits={pins} mapProvider={provider} selectedId={selectedPin?.id} selectionRequest={0} manualMode={manual} onManualPoint={manualPoint} onSelect={(pin) => { setPinChoices(pin.items.map((item) => item.id)); setSelectedId(pin.items[0].id); }} route={visibleRoute} />
          <div className="planner-map-controls"><button disabled={busy} aria-pressed={provider === "kakao"} onClick={() => setProvider("kakao")}>국내</button><button disabled={busy} aria-pressed={provider === "osm"} onClick={() => setProvider("osm")}>해외</button></div>
          
        </div><div className="planner-map-agenda" aria-label="선택한 날짜의 장소"><div className="planner-route-heading"><strong>{date} · {today.length}개 일정</strong><button disabled={busy || pins.length < 2 || routeBusy} onClick={() => { if (visibleRoute) { setSavedRoute(undefined); setRouteFeedback(undefined); } else void showRoute(); }}>{routeBusy ? "경로 확인 중…" : visibleRoute ? "동선 숨기기" : "동선 확인"}</button></div>{(visibleRoute || routeNotice) && <p className={`planner-route-status ${visibleRoute?.kind === "road" ? "is-road" : ""}`}>{visibleRoute?.kind === "road" ? "자동차 경로" : visibleRoute ? "장소 순서 연결선" : ""}{visibleRoute?.distanceMeters !== undefined && ` · ${(visibleRoute.distanceMeters / 1000).toFixed(1)} km`}{visibleRoute?.durationSeconds !== undefined && ` · ${Math.round(visibleRoute.durationSeconds / 60)}분`}{routeNotice && ` · ${routeNotice}`}</p>}{pins.length < 2 && <p>동선을 보려면 서로 다른 장소를 두 곳 이상 추가해 주세요.</p>}{!today.length && <p>이 날짜에 일정을 추가하면 지도 핀도 표시돼요.</p>}{today.filter((segment) => !pinChoices.length || pinChoices.includes(segment.item.id)).map(({ item, order }) => <button key={item.id} aria-pressed={selectedId === item.id} onClick={() => chooseItem(item, true)}><b>{order}</b><span>{item.startsAt.slice(11)}–{item.endsAt.slice(11)}</span><strong>{item.place.name}</strong></button>)}{pinChoices.length > 0 && <button onClick={() => setPinChoices([])}>이 날짜의 모든 장소</button>}</div></div>
      </div>
    </>}

    <dialog className="planner-dialog" ref={tripDialog} aria-label="여행 설정" onCancel={(event) => { if (busy) event.preventDefault(); else setTripDraft(undefined); }}>
      {tripDraft && <form onSubmit={saveTrip}><h2>{tripDraft.id ? "여행 설정" : "새 여행 만들기"}</h2><label>여행 이름<input required maxLength={120} autoFocus value={tripDraft.name} onChange={(event) => setTripDraft({ ...tripDraft, name: event.target.value })} placeholder="예: 제주 2박 3일" /></label><div className="planner-form-row"><label>시작일<input type="date" required value={tripDraft.startDate} onChange={(event) => setTripDraft({ ...tripDraft, startDate: event.target.value })} /></label><label>종료일<input type="date" required min={tripDraft.startDate} value={tripDraft.endDate} onChange={(event) => setTripDraft({ ...tripDraft, endDate: event.target.value })} /></label></div><label>여행 시간대<input required list="trip-time-zones" value={tripDraft.timeZone} onChange={(event) => setTripDraft({ ...tripDraft, timeZone: event.target.value })} /><datalist id="trip-time-zones">{zoneOptions.map((zone) => <option key={zone} value={zone} />)}</datalist></label><p>모든 멤버에게 이 여행의 현지 시각으로 보여요. 시간대를 바꿔도 입력한 시각은 유지돼요.</p>{formError && <p className="planner-error" role="alert">{formError}</p>}<div className="planner-form-actions">{tripDraft.id && <button type="button" className="danger-button" disabled={busy} onClick={async () => { if (!confirm("이 여행과 일정을 삭제할까요? 기존 방문 기록은 유지됩니다.")) return; try { await store.deleteTrip(tripDraft as Trip); setTripDraft(undefined); tripDialog.current?.close(); } catch (error) { setFormError((error as Error).message); } }}>여행 삭제</button>}<button type="button" disabled={busy} onClick={() => { setTripDraft(undefined); tripDialog.current?.close(); }}>취소</button><button className="primary-button" disabled={busy} type="submit">{busy ? "저장 중…" : "여행 저장"}</button></div></form>}
    </dialog>
    <dialog className="planner-dialog" ref={itemDialog} aria-label="일정 편집" onCancel={(event) => { if (busy) event.preventDefault(); else clearItem(); }}>
      {draft && <div><h2>{draft.id ? "일정 수정" : "일정 추가"}</h2><form id="schedule-form" onSubmit={saveItem}>
        <div className="planner-form-row"><label>시작 날짜와 시간<input aria-label="일정 시작" type="datetime-local" required value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} /></label><label>종료 날짜와 시간<input aria-label="일정 종료" type="datetime-local" required value={draft.endsAt} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} /></label></div>
        <label>일정 제목<input value={draft.title} maxLength={120} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="장소 이름을 제목으로 사용할 수 있어요" /></label>
        {draft.place && <div className="planner-chosen-place"><MapPin size={18} /><div><strong>{draft.place.name}</strong><small>{draft.place.address || `${draft.place.latitude.toFixed(5)}, ${draft.place.longitude.toFixed(5)}`}</small></div><button type="button" onClick={() => setDraft({ ...draft, place: undefined })}>장소 변경</button></div>}
        {draft.newPlace && draft.place && <label>장소 이름<input required maxLength={120} value={draft.place.name} onChange={(event) => setDraft({ ...draft, place: { ...draft.place!, name: event.target.value } })} /></label>}
        <label>메모<textarea value={draft.note} maxLength={3000} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="예약 시간, 준비물 등을 적어두세요" /></label>
      </form>
      {!draft.place && <div className="planner-place-picker"><div className="planner-source-tabs"><button aria-pressed={source === "search"} onClick={() => { setSource("search"); setQuery(""); }}>장소 검색</button><button aria-pressed={source === "records"} onClick={() => { setSource("records"); setQuery(""); }}>기존 기록</button></div>
        {source === "search" ? <><form className="planner-search" onSubmit={searchPlaces}><input aria-label="일정 장소 검색" value={query} onChange={(event) => { searchEpoch.current++; setSearching(false); setQuery(event.target.value); setResults([]); }} placeholder="장소, 도시, 주소" /><select aria-label="일정 검색 지역" value={provider} onChange={(event) => { searchEpoch.current++; setSearching(false); setResults([]); setProvider(event.target.value as "kakao" | "osm"); }}><option value="kakao">국내</option><option value="osm">해외</option></select><button disabled={searching}><Search size={16} />{searching ? "찾는 중" : "검색"}</button></form><div className="planner-search-results">{results.map((result) => <button key={result.id} onClick={() => pickPlace({ id: crypto.randomUUID(), provider: provider === "kakao" ? "kakao" : "manual", providerPlaceId: provider === "kakao" ? result.id : undefined, name: result.placeName, address: result.roadAddressName || result.addressName, category: result.categoryName, latitude: result.latitude, longitude: result.longitude }, true)}><strong>{result.placeName}</strong><small>{result.roadAddressName || result.addressName}</small></button>)}</div></> : <><input aria-label="일정에 넣을 기존 기록 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="장소 또는 기록 제목" /><label className="planner-checkbox"><input type="checkbox" checked={plannedOnly} onChange={(event) => setPlannedOnly(event.target.checked)} />방문 예정만</label><div className="planner-search-results">{records.map((visit) => <button key={visit.id} onClick={() => pickPlace(visit.place, false, normalizeMarkerStyle(visit.markerStyle))}><strong>{visit.place.name}</strong><small>{visit.visitedOn} · {visit.title}{visit.isPlanned ? " · 방문 예정" : ""}</small></button>)}{!records.length && <p>선택할 기록이 없어요. 장소를 검색하거나 직접 선택해 주세요.</p>}</div></>}
        <button className="planner-manual-button" onClick={() => { searchEpoch.current++; setSearching(false); setManual(true); setTab("map"); itemDialog.current?.close(); }}><MapPin size={16} />지도에서 직접 선택</button>
      </div>}
      {formError && <p className="planner-error" role="alert">{formError}</p>}<div className="planner-form-actions">{draft.id && <button className="danger-button" disabled={busy} onClick={async () => { if (!trip || !confirm("이 일정을 삭제할까요?")) return; const item = items.find((value) => value.id === draft.id); if (!item) return; try { await store.deleteItem(trip, item); clearItem(); setSelectedId(undefined); } catch (error) { setFormError((error as Error).message); } }}>일정 삭제</button>}<button disabled={busy} onClick={clearItem}>취소</button><button form="schedule-form" type="submit" className="primary-button" disabled={busy}>{busy ? "저장 중…" : "일정 저장"}</button></div></div>}
    </dialog>
  </section>;
}
