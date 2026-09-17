"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { CalendarDays, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Filter, Globe2, List, LocateFixed, LogOut, Map as MapIcon, MapPin, Menu, Palette, Plus, Search, Users, X } from "lucide-react";
import { KakaoMap, type MapAnchor } from "@/components/kakao-map";
import { GroupOnboarding } from "@/components/group-onboarding";
import { InstallAppButton } from "@/components/install-app-button";
import { FontPicker } from "@/components/font-preference";
import { RatingPicker } from "@/components/rating-picker";
import { SquareSparkIcon } from "@/components/square-spark-icon";
import { prepareVisitImage } from "@/lib/images";
import { DEFAULT_MARKER_STYLE, MARKER_PICKER_STYLE_IDS as MARKER_STYLE_IDS, markerSvgDataUrl, normalizeMarkerStyle, type MarkerStyle } from "@/lib/marker-styles";

const markerSvgData = markerSvgDataUrl;
const formatRating = (rating: number) => rating.toFixed(1);
import { getMemberInitials } from "@/lib/member-initials";
import { DEFAULT_THEME, normalizeTheme, THEME_OPTIONS, type ThemeId } from "@/lib/themes";
import { visitSchema } from "@/lib/schemas";
import type { DashboardData } from "@/lib/data";
import type { Group, KakaoPlaceResult, Place, Visit } from "@/types/domain";

const formatDate = (date: string) => new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", weekday: "short" }).format(new Date(`${date}T12:00:00`));
const VISITS_STORAGE_KEY = "place-memory-visits-v2";
const GROUPS_STORAGE_KEY = "place-memory-groups-v1";
const THEME_STORAGE_KEY = "place-memory-theme-v1";
const MAP_PROVIDER_STORAGE_KEY = "place-memory-map-provider-v1";
type MapProvider = "kakao" | "osm";
type PopupPlacement = "right" | "left" | "above" | "below";
interface PopupPosition { left: number; top: number; placement: PopupPlacement; tailX: number; tailY: number; tailLength: number; }
type PopupStyle = CSSProperties & { "--tail-x": string; "--tail-y": string; "--tail-length": string; };

export function MapJournal({ initialData, viewerId, viewerName }: { initialData: DashboardData; viewerId?: string; viewerName?: string }) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialData.groups);
  const [activeGroupId, setActiveGroupId] = useState(initialData.groups[0]?.id ?? "");
  const [visits, setVisits] = useState(initialData.visits);
  const [storageReady, setStorageReady] = useState(() => !initialData.demoMode);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [selectedAnchor, setSelectedAnchor] = useState<MapAnchor>();
  const [selectionRequest, setSelectionRequest] = useState(0);
  const [popupPosition, setPopupPosition] = useState<PopupPosition>();
  const [pendingAction, setPendingAction] = useState<"save" | "delete">();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KakaoPlaceResult[]>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [mapProvider, setMapProvider] = useState<MapProvider>("kakao");
  const [tag, setTag] = useState("전체");
  const [mobileList, setMobileList] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [formError, setFormError] = useState("");
  const [draftPlace, setDraftPlace] = useState<Place | null>(null);
  const [editing, setEditing] = useState<Visit | null>(null);
  const [markerStyle, setMarkerStyle] = useState<MarkerStyle>(DEFAULT_MARKER_STYLE);
  const [notice, setNotice] = useState(initialData.demoMode ? "서버 저장소를 연결하면 모든 기기에서 같은 기록을 볼 수 있어요." : "");
  const [groupMenu, setGroupMenu] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number }>();
  const [mapFocus, setMapFocus] = useState<{ latitude: number; longitude: number }>();
  const [pulseLocation, setPulseLocation] = useState<{ latitude: number; longitude: number }>();
  const [selectedDateKey, setSelectedDateKey] = useState<string | undefined>();
  const [photoView, setPhotoView] = useState<{ visitId: string; index: number }>({ visitId: "", index: 0 });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const groupDialogRef = useRef<HTMLDialogElement>(null);
  const mapStageRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sidebarOpener = useRef<HTMLElement | null>(null);
  const photoTouchStartX = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(MAP_PROVIDER_STORAGE_KEY);
    if (saved !== "kakao" && saved !== "osm") return;
    const restore = window.setTimeout(() => setMapProvider(saved), 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (!isMobile || !mobileList) return;
    const sidebar = sidebarRef.current;
    const visitDialog = dialogRef.current;
    const groupDialog = groupDialogRef.current;
    const previousFocus = sidebarOpener.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (visitDialog?.open || groupDialog?.open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileList(false);
      }
      if (event.key !== "Tab" || !sidebar) return;
      const controls = Array.from(sidebar.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'))
        .filter((element) => element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (!visitDialog?.open && !groupDialog?.open && previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [isMobile, mobileList]);

  function openMobileList(entry: "records" | "search" | "groups" = "records") {
    sidebarOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Focus during the tap so mobile keyboards can open with the search field.
    flushSync(() => {
      setManualMode(false);
      setGroupMenu(false);
      setThemePickerOpen(false);
      setGroupPickerOpen(entry === "groups");
      setMobileList(true);
    });
    const target = entry === "search" ? searchInputRef.current
      : sidebarRef.current?.querySelector<HTMLButtonElement>(entry === "groups" ? ".group-picker-trigger" : ".mobile-close");
    target?.focus({ preventScroll: true });
  }

  useEffect(() => {
    try {
      setTheme(normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY)));
    } finally {
      setThemeLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!themeLoaded) return;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, themeLoaded]);

  useEffect(() => {
    if (!initialData.demoMode) return;
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(VISITS_STORAGE_KEY);
        const savedGroups = window.localStorage.getItem(GROUPS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Visit[];
          if (Array.isArray(parsed)) setVisits(parsed.map((visit) => ({ ...visit, markerStyle: normalizeMarkerStyle(visit.markerStyle) })));
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
  }, [initialData.demoMode]);

  useEffect(() => {
    if (!initialData.demoMode || !storageReady) return;
    window.localStorage.setItem(VISITS_STORAGE_KEY, JSON.stringify(visits));
    window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  }, [groups, initialData.demoMode, storageReady, visits]);

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0];
  const groupVisits = useMemo(() => visits.filter((visit) => visit.groupId === activeGroupId && (tag === "전체" || (tag === "방문 예정" ? visit.isPlanned : visit.tags.includes(tag)))), [activeGroupId, tag, visits]);
  const dateGroups = useMemo(() => {
    const grouped = new Map<string, Visit[]>();
    [...groupVisits].sort((a, b) => b.visitedOn.localeCompare(a.visitedOn)).forEach((visit) => grouped.set(visit.visitedOn, [...(grouped.get(visit.visitedOn) ?? []), visit]));
    return Array.from(grouped, ([date, dateVisits]) => ({ date, visits: dateVisits }));
  }, [groupVisits]);
  const highlightedIds = useMemo(() => dateGroups.find((group) => group.date === selectedDateKey)?.visits.map((visit) => visit.id) ?? [], [dateGroups, selectedDateKey]);
  const allTags = useMemo(() => ["전체", "방문 예정", ...Array.from(new Set(visits.flatMap((visit) => visit.tags))).slice(0, 4)], [visits]);
  const selected = visits.find((visit) => visit.id === selectedId);
  const activePhotoIndex = selected && photoView.visitId === selected.id ? Math.min(photoView.index, Math.max(0, selected.photoUrls.length - 1)) : 0;
  const activePhotoUrl = selected?.photoUrls[activePhotoIndex];
  const mapSummary = groupVisits.length ? `${groupVisits.length}곳의 기록` : "첫 장소를 남겨보세요";
  const canManageActiveGroup = initialData.demoMode ? activeGroup?.ownerId === viewerId : activeGroup?.role === "owner";
  const sheetStyle: PopupStyle | undefined = popupPosition ? {
    left: popupPosition.left,
    top: popupPosition.top,
    "--tail-x": `${popupPosition.tailX}px`,
    "--tail-y": `${popupPosition.tailY}px`,
    "--tail-length": `${popupPosition.tailLength}px`,
  } : undefined;

  const handleAnchorChange = useCallback((anchor?: MapAnchor) => {
    setSelectedAnchor(anchor);
    if (!anchor) setPopupPosition(undefined);
  }, []);

  const handlePopupDismiss = useCallback(() => {
    setSelectedAnchor(undefined);
    setPopupPosition(undefined);
  }, []);

  const handleVisitSelect = useCallback((visit: Visit) => {
    setNotice("");
    setMapFocus(undefined);
    setPulseLocation(undefined);
    setSheetExpanded(false);
    setPhotoView({ visitId: visit.id, index: 0 });
    setSelectedId(visit.id);
    setSelectedAnchor(undefined);
    setSelectionRequest((request) => request + 1);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const dismissOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && sheetRef.current?.contains(target)) return;
      setSelectedId(undefined);
      setSelectedAnchor(undefined);
      setPopupPosition(undefined);
    };
    document.addEventListener("pointerdown", dismissOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", dismissOnOutsidePointer, true);
  }, [selectedId]);

  function showPhoto(offset: number) {
    if (!selected || selected.photoUrls.length < 2) return;
    setPhotoView((current) => {
      const index = current.visitId === selected.id ? current.index : 0;
      return { visitId: selected.id, index: (index + offset + selected.photoUrls.length) % selected.photoUrls.length };
    });
  }

  useLayoutEffect(() => {
    if (!selected || !selectedAnchor || !mapStageRef.current || !sheetRef.current) {
      setPopupPosition(undefined);
      return;
    }
    const updatePosition = () => {
      if (!mapStageRef.current || !sheetRef.current) return;
      const stage = mapStageRef.current.getBoundingClientRect();
      const sheet = sheetRef.current.getBoundingClientRect();
      const gap = 34;
      const edge = 24;
      const anchorTop = selectedAnchor.topY ?? selectedAnchor.y;
      const anchorCenterY = (anchorTop + selectedAnchor.y) / 2;
      const canPlaceAbove = anchorTop - sheet.height - gap >= edge;
      const canPlaceBelow = selectedAnchor.y + sheet.height + gap <= stage.height - edge;
      const canPlaceRight = selectedAnchor.x + sheet.width + gap <= stage.width - edge;
      let placement: PopupPlacement;
      let left: number;
      let top: number;
      if (canPlaceAbove) {
        placement = "above";
        left = selectedAnchor.x - sheet.width / 2;
        top = anchorTop - sheet.height - gap;
      } else if (canPlaceBelow) {
        placement = "below";
        left = selectedAnchor.x - sheet.width / 2;
        top = selectedAnchor.y + gap;
      } else if (canPlaceRight) {
        placement = "right";
        left = selectedAnchor.x + gap;
        top = anchorCenterY - sheet.height / 2;
      } else {
        placement = "left";
        left = selectedAnchor.x - sheet.width - gap;
        top = anchorCenterY - sheet.height / 2;
      }
      const clampedLeft = Math.max(edge, Math.min(left, stage.width - sheet.width - edge));
      const clampedTop = Math.max(edge, Math.min(top, stage.height - sheet.height - edge));
      setPopupPosition({
        left: clampedLeft,
        top: clampedTop,
        placement,
        tailX: Math.max(24, Math.min(selectedAnchor.x - clampedLeft, sheet.width - 24)),
        tailY: Math.max(24, Math.min(anchorCenterY - clampedTop, sheet.height - 24)),
        tailLength: placement === "right" ? clampedLeft - selectedAnchor.x + 1
          : placement === "left" ? selectedAnchor.x - (clampedLeft + sheet.width) + 1
            : placement === "below" ? clampedTop - selectedAnchor.y + 1
              : anchorTop - (clampedTop + sheet.height) + 1,
      });
    };
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(sheetRef.current);
    window.addEventListener("resize", updatePosition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePosition);
    };
  }, [selected, selectedAnchor]);

  function openForPlace(place: Place) {
    if (dialogRef.current?.open) return;
    const location = { latitude: place.latitude, longitude: place.longitude };
    setMapFocus(location);
    setPulseLocation(location);
    setMobileList(false);
    setFormError("");
    setSelectedId(undefined); setSelectedAnchor(undefined); setNotice(""); setDraftPlace(place); setEditing(null); setMarkerStyle(DEFAULT_MARKER_STYLE); setManualMode(false); setSearchResults([]); dialogRef.current?.showModal();
  }
  function openEdit(visit: Visit) { setFormError(""); setDraftPlace(visit.place); setEditing(visit); setMarkerStyle(normalizeMarkerStyle(visit.markerStyle)); dialogRef.current?.showModal(); }

  function chooseGroup(groupId: string) {
    setMapFocus(undefined);
    setPulseLocation(undefined);
    setActiveGroupId(groupId);
    setTag("전체");
    setSelectedId(undefined);
    setSelectedAnchor(undefined);
    setSelectedDateKey(undefined);
    setGroupPickerOpen(false);
  }

  function startManualPin() {
    setMapFocus(undefined);
    setPulseLocation(undefined);
    setManualMode(true);
    setSelectedId(undefined);
    setSelectedAnchor(undefined);
    setMobileList(false);
    setNotice("");
  }

  async function searchPlaces(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return setSearchMessage("두 글자 이상 입력해 주세요.");
    setSearching(true); setSearchMessage("");
    try {
      const response = await fetch(`/api/places/search?q=${encodeURIComponent(query.trim())}&map=${mapProvider}`);
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

  function changeMapProvider(nextProvider: MapProvider) {
    if (nextProvider === mapProvider) return;
    setMapProvider(nextProvider);
    window.localStorage.setItem(MAP_PROVIDER_STORAGE_KEY, nextProvider);
    setSelectedId(undefined);
    setSelectedAnchor(undefined);
    setMapFocus(undefined);
    setPulseLocation(undefined);
    setManualMode(false);
    setSearchResults([]);
    setSearchMessage("");
    setNotice(nextProvider === "osm" ? "해외 지도로 전환했습니다. 장소를 검색하거나 지도를 눌러 기록하세요." : "국내 지도로 전환했습니다.");
  }

  const manualPoint = useCallback((latitude: number, longitude: number) => {
    if (dialogRef.current?.open) return;
    setSelectedId(undefined);
    setSelectedAnchor(undefined);
    setPulseLocation(undefined);
    setNotice("");
    setFormError("");
    setDraftPlace({ id: crypto.randomUUID(), provider: "manual", name: "", address: "", category: "직접 지정", latitude, longitude });
    setEditing(null);
    setManualMode(false);
    setSearchResults([]);
    dialogRef.current?.showModal();
  }, []);

  async function saveVisit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftPlace || !activeGroup || pendingAction) return;
    setFormError("");
    const form = new FormData(event.currentTarget);
    const files = form.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0).slice(0, 5);
    const participantIds = initialData.members.filter((member) => form.get(`member-${member.id}`) === "on").map((member) => member.id);
    const raw = { id: editing?.id, groupId: activeGroup.id, place: { ...draftPlace, name: String(form.get("placeName") ?? draftPlace.name), address: String(form.get("address") ?? draftPlace.address) }, visitedOn: String(form.get("visitedOn")), isPlanned: form.get("isPlanned") === "on", title: String(form.get("title")), note: String(form.get("note")), rating: Number(form.get("rating")), tags: String(form.get("tags") ?? "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8), participantIds, markerStyle: String(form.get("markerStyle") ?? DEFAULT_MARKER_STYLE), version: editing?.version ?? 1 };
    const parsed = visitSchema.safeParse(raw);
    if (!parsed.success) return setFormError(parsed.error.issues[0]?.message ?? "입력을 확인해 주세요.");

    let id = editing?.id ?? crypto.randomUUID(); let version = editing?.version ?? 1; let photoUrls = editing?.photoUrls ?? [];
    setPendingAction("save");
    try {
      const preparedFiles = files.length ? await Promise.all(files.map(prepareVisitImage)) : [];
      if (!initialData.demoMode) {
        const response = await fetch("/api/visits", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        id = data.id; version = data.version;
        if (preparedFiles.length) {
          const photoData = new FormData();
          preparedFiles.forEach((file) => photoData.append("photos", file, file.name));
          const photoResponse = await fetch(`/api/visits/${id}/photos`, { method: "POST", body: photoData });
          const photoResult = await photoResponse.json();
          if (!photoResponse.ok) throw new Error(photoResult.error);
          photoUrls = [...photoUrls, ...(photoResult.photoUrls ?? [])];
        }
      } else if (preparedFiles.length) photoUrls = preparedFiles.map((file) => URL.createObjectURL(file));

      const nextVisit: Visit = { id, groupId: activeGroup.id, place: parsed.data.place as Place, visitedOn: parsed.data.visitedOn, isPlanned: parsed.data.isPlanned, title: parsed.data.title, note: parsed.data.note, rating: parsed.data.rating, tags: parsed.data.tags, participants: initialData.members.filter((member) => participantIds.includes(member.id)), photoUrls, markerStyle: parsed.data.markerStyle, version, updatedBy: initialData.members[0]?.displayName ?? "나" };
    setVisits((current) => editing ? current.map((visit) => visit.id === editing.id ? nextVisit : visit) : [nextVisit, ...current]);
      setSelectedId(id); setSelectedAnchor(undefined); setSelectionRequest((request) => request + 1); setSelectedDateKey(parsed.data.visitedOn); setNotice(editing ? "기록을 고쳤습니다." : "새로운 기억을 지도에 남겼습니다."); dialogRef.current?.close();
    } catch (error) { setFormError(error instanceof Error ? error.message : "기록을 저장하지 못했습니다."); }
    finally { setPendingAction(undefined); }
  }

  async function deleteVisit(visit: Visit) {
    if (pendingAction || !window.confirm(`“${visit.place.name}” 방문 기록을 삭제할까요?`)) return;
    setPendingAction("delete");
    setMapFocus(undefined);
    setPulseLocation(undefined);
    try {
      if (!initialData.demoMode) {
        const response = await fetch("/api/visits", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: visit.id, version: visit.version }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
      }
      setVisits((current) => current.filter((item) => item.id !== visit.id));
      setSelectedId(undefined);
      setSelectedAnchor(undefined);
      setSelectedDateKey(undefined);
      setNotice("방문 기록을 삭제했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "방문 기록을 삭제하지 못했습니다.");
    } finally {
      setPendingAction(undefined);
    }
  }

  function openCreateGroup() {
    setGroupPickerOpen(false);
    setNewGroupName("");
    groupDialogRef.current?.showModal();
  }

  async function createGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newGroupName.trim();
    if (name.length < 2) return setNotice("지도 이름을 두 글자 이상 입력해 주세요.");
    let group: Group = { id: crypto.randomUUID(), name, role: "owner", memberCount: 4, ownerId: viewerId };
    if (!initialData.demoMode) {
      try {
        const response = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        group = data.group as Group;
      } catch (error) {
        return setNotice(error instanceof Error ? error.message : "지도를 만들지 못했습니다.");
      }
    }
    setGroups((current) => [...current, group]);
    setActiveGroupId(group.id);
    setSelectedId(undefined);
    setSelectedDateKey(undefined);
    setNotice(`“${name}” 지도를 만들었습니다.`);
    groupDialogRef.current?.close();
  }

  async function createInvite() {
    if (!activeGroup || !canManageActiveGroup) return setNotice("이 지도는 만든 사람만 관리할 수 있어요.");
    if (initialData.demoMode) return setNotice("서버 저장소를 연결하면 초대 링크를 만들 수 있어요.");
    const response = await fetch("/api/groups/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: activeGroup.id }) });
    const data = await response.json();
    if (!response.ok) return setNotice(data.error);
    setInviteLink(data.url); await navigator.clipboard.writeText(data.url); setNotice("7일 동안 유효한 초대 링크를 복사했습니다.");
  }

  async function deleteGroup() {
    if (!activeGroup || !canManageActiveGroup) return setNotice("이 지도는 만든 사람만 삭제할 수 있어요.");
    if (groups.length <= 1) return setNotice("마지막 지도는 삭제할 수 없어요. 새 지도를 만든 뒤 다시 시도해 주세요.");
    const visitCount = visits.filter((visit) => visit.groupId === activeGroup.id).length;
    if (!window.confirm(`“${activeGroup.name}” 지도와 방문 기록 ${visitCount}개를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;

    try {
      if (!initialData.demoMode) {
        const response = await fetch(`/api/groups/${activeGroup.id}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
      }
      const nextGroups = groups.filter((group) => group.id !== activeGroup.id);
      const nextGroup = nextGroups[0];
      setGroups(nextGroups);
      setVisits((current) => current.filter((visit) => visit.groupId !== activeGroup.id));
      setActiveGroupId(nextGroup.id);
      setTag("전체");
      setSelectedId(undefined);
      setSelectedDateKey(undefined);
      setGroupMenu(false);
      setNotice(`“${activeGroup.name}” 지도를 삭제했습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "지도를 삭제하지 못했습니다.");
    }
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
    <main className="journal-app" data-theme={theme}>
      {mobileList && <div className="sidebar-backdrop" aria-hidden="true" onClick={() => setMobileList(false)} />}
      <aside ref={sidebarRef} id="journal-sidebar" className={`journal-sidebar ${mobileList ? "mobile-open" : ""}`} inert={isMobile && !mobileList} role={isMobile && mobileList ? "dialog" : undefined} aria-modal={isMobile && mobileList ? true : undefined} aria-label="기록 목록과 장소 검색">
        <header className="sidebar-header"><div className="wordmark"><span className="wordmark-pin"><img src="/map-pins/sparkle-yellow-round.png" alt="" /></span><span>PLACE<br />MEMORY MAP</span></div><button className="icon-button mobile-close" onClick={() => setMobileList(false)} aria-label="목록 닫기"><X size={20} /></button></header>
        <div className="group-row"><label id="group-label">함께 보는 지도</label><div className="group-picker"><button className="group-picker-trigger" type="button" aria-labelledby="group-label" aria-haspopup="listbox" aria-expanded={groupPickerOpen} onClick={() => setGroupPickerOpen((value) => !value)}><span>{activeGroup?.name ?? "지도 선택"}</span><ChevronDown size={17} /></button>{groupPickerOpen && <div className="group-picker-menu" role="listbox" aria-label="함께 보는 지도 선택">{groups.filter((group) => group.id !== activeGroupId).map((group) => <button key={group.id} className="group-picker-option" type="button" role="option" aria-selected={false} onClick={() => chooseGroup(group.id)}>{group.name}<span>{visits.filter((visit) => visit.groupId === group.id).length}건</span></button>)}<button className="group-picker-add" type="button" onClick={openCreateGroup}><Plus size={15} />함께 보는 지도 추가</button></div>}</div></div>
        <div className="search-area"><form className="place-search" role="search" onSubmit={searchPlaces}><Search size={19} aria-hidden="true" /><input ref={searchInputRef} type="search" enterKeyHint="search" value={query} onChange={(event) => { setQuery(event.target.value); setSearchResults([]); setSearchMessage(""); }} placeholder={mapProvider === "osm" ? "도시, 명소, 주소로 해외 검색" : "장소 이름으로 국내 검색"} aria-label="장소 검색" autoComplete="off" /><button type="submit" disabled={searching}>{searching ? "찾는 중" : "찾기"}</button></form>{(searchResults.length > 0 || searchMessage) && <div className="search-popover" aria-live="polite">{searchResults.map((result) => <button key={result.id} type="button" onClick={() => openForPlace({ id: crypto.randomUUID(), provider: mapProvider === "osm" ? "manual" : "kakao", providerPlaceId: result.id, name: result.placeName, address: result.roadAddressName || result.addressName, category: result.categoryName, latitude: result.latitude, longitude: result.longitude })}><strong>{result.placeName}</strong><span>{result.roadAddressName || result.addressName}</span></button>)}{searchMessage && <p>{searchMessage}</p>}<button className="search-manual" type="button" onClick={startManualPin}>찾는 장소가 없나요? 지도에서 직접 선택</button></div>}</div>
        <div className="filter-row" aria-label="기록 필터"><Filter size={15} />{allTags.map((item) => <button key={item} type="button" className={tag === item ? "active" : ""} aria-pressed={tag === item} onClick={() => setTag(item)}>{item}</button>)}</div>
        <div className="record-heading"><div><h1>기록</h1><p>{groupVisits.length}개의 방문 기록</p></div></div>
        <div className="record-list">
          {!groupVisits.length && <div className="empty-records"><MapPin size={24} /><strong>아직 남긴 발자국이 없어요.</strong><span>장소를 검색하거나, 지도에서 위치를 직접 고를 수 있어요.</span><button type="button" onClick={startManualPin}><Plus size={16} />지도에서 첫 장소 추가</button></div>}
          {dateGroups.map(({ date, visits: dateVisits }) => {
            const active = selectedDateKey === date;
            return <section key={date} className={`date-group ${active ? "active" : ""}`}>
              <button className="date-group-toggle" aria-expanded={active} aria-label={`${formatDate(date)} 방문 기록 ${dateVisits.length}개 ${active ? "접기" : "펼치기"}`} onClick={() => { setSelectedDateKey(active ? undefined : date); if (!active && dateVisits[0]) handleVisitSelect(dateVisits[0]); }}><span><CalendarDays size={15} /><time>{formatDate(date)}</time>{dateVisits.some((visit) => visit.isPlanned) && <em>방문 예정</em>}</span><strong>{dateVisits.length}곳 <ChevronDown size={15} /></strong></button>
              {active && <div className="date-group-items">{dateVisits.map((visit) => <button key={visit.id} className={`record-item ${visit.isPlanned ? "planned" : ""} ${selectedId === visit.id ? "selected" : ""}`} aria-pressed={selectedId === visit.id} onClick={() => { handleVisitSelect(visit); setMobileList(false); }}><img className="record-marker" src={markerSvgData(visit.markerStyle)} alt="" /><div><strong>{visit.place.name}</strong><p>{visit.title}</p><div className="mini-meta"><span className="rating-summary" aria-label={`별점 ${formatRating(visit.rating)}점`}><SquareSparkIcon className="rating-square-spark" /> {formatRating(visit.rating)}</span><span><Users size={13} /> {visit.participants.length}</span>{visit.photoUrls.length > 0 && <span><Camera size={13} /> {visit.photoUrls.length}</span>}{visit.isPlanned && <span className="planned-label">방문 예정</span>}</div></div></button>)}</div>}
            </section>;
          })}
        </div>
        <footer className="sidebar-footer"><span className="avatar">{getMemberInitials(viewerName ?? initialData.members[0]?.displayName ?? "여행자")}</span><div><strong>{viewerName ?? initialData.members[0]?.displayName ?? "여행자"}</strong><span>{initialData.demoMode ? "간편 로그인" : "로그인됨"}</span></div><button className="icon-button" aria-label="그룹 메뉴" onClick={() => setGroupMenu((value) => !value)}><Menu size={19} /></button>{groupMenu && <div className="group-menu"><strong>{activeGroup?.name}</strong><span>구성원 {activeGroup?.memberCount}명 · {canManageActiveGroup ? "그룹장" : "멤버"}</span><button className="theme-toggle" type="button" aria-expanded={themePickerOpen} onClick={() => setThemePickerOpen((value) => !value)}><Palette size={15} />테마 선택<ChevronDown size={14} /></button>{themePickerOpen && <div className="theme-picker" role="radiogroup" aria-label="테마 선택">{THEME_OPTIONS.map((option) => <button key={option.id} className={`theme-option ${theme === option.id ? "active" : ""}`} type="button" role="radio" aria-checked={theme === option.id} onClick={() => { setTheme(option.id); setThemePickerOpen(false); }}><span className="theme-swatch" style={{ background: option.swatch }} /><span><strong>{option.label}</strong><small>{option.description}</small></span>{theme === option.id && <Check size={14} aria-hidden="true" />}</button>)}</div>}<FontPicker />{canManageActiveGroup && <button onClick={createInvite}>초대 링크 만들기</button>}{inviteLink && <input value={inviteLink} readOnly aria-label="초대 링크" />}<InstallAppButton />{canManageActiveGroup && <button className="group-menu-delete" type="button" disabled={groups.length <= 1} title={groups.length <= 1 ? "마지막 지도는 삭제할 수 없습니다." : undefined} onClick={deleteGroup}>현재 지도 삭제</button>}{canManageActiveGroup && groups.length <= 1 && <small className="group-menu-hint">마지막 지도는 삭제할 수 없어요.</small>}<button className="group-menu-logout" onClick={logout}><LogOut size={15} />로그아웃</button></div>}</footer>
      </aside>

      <section ref={mapStageRef} className="map-stage" inert={isMobile && mobileList}>
        <KakaoMap key={mapProvider} visits={groupVisits} mapProvider={mapProvider} selectedId={selectedId} selectionRequest={selectionRequest} highlightedIds={highlightedIds} manualMode={manualMode} onSelect={handleVisitSelect} onAnchorChange={handleAnchorChange} onDismissPopup={handlePopupDismiss} onManualPoint={manualPoint} focusLocation={currentLocation} mapFocus={mapFocus} pulseLocation={pulseLocation} />
        <div className="map-topbar"><button className="icon-button mobile-list-button" onClick={() => openMobileList()} aria-label="기록 목록 열기" aria-controls="journal-sidebar" aria-expanded={mobileList}><List size={20} /></button><button className="mobile-search-button" onClick={() => openMobileList("search")}><Search size={18} /><span>장소 검색</span></button><div className="map-date"><CalendarDays size={16} /><span>{mapSummary}</span></div><button className="location-button" onClick={locateMe}><LocateFixed size={17} />내 위치</button></div>
        <div className="map-provider-switch" role="group" aria-label="지도 선택"><button type="button" className={mapProvider === "kakao" ? "active" : ""} aria-pressed={mapProvider === "kakao"} onClick={() => changeMapProvider("kakao")}><MapIcon size={15} />국내</button><button type="button" className={mapProvider === "osm" ? "active" : ""} aria-pressed={mapProvider === "osm"} onClick={() => changeMapProvider("osm")}><Globe2 size={15} />해외</button></div>
        <button className={`add-pin-button ${manualMode ? "active" : ""}`} aria-label={manualMode ? "핀 추가 취소" : "지도에 핀 추가"} onClick={() => manualMode ? setManualMode(false) : startManualPin()}><Plus size={19} /><span>{manualMode ? "핀 추가 취소" : "지도에 핀 추가"}</span></button>
        {selected && <article ref={sheetRef} aria-label={`${selected.place.name} 방문 기록`} className={`place-sheet ${activePhotoUrl ? "has-photo" : ""} ${popupPosition ? "is-positioned" : ""} ${sheetExpanded ? "is-expanded" : ""}`} data-placement={popupPosition?.placement} style={sheetStyle}>
          {pendingAction === "delete" && <div className="operation-progress" role="progressbar" aria-label="기록 삭제 중" />}
          <div className="sheet-toolbar">
            <button className="sheet-expand" type="button" aria-expanded={sheetExpanded} aria-controls="visit-detail-body" onClick={() => { setNotice(""); setSheetExpanded((value) => !value); }}><ChevronDown size={18} />{sheetExpanded ? "지도와 함께 보기" : "기록 크게 보기"}</button>
            <button className="sheet-close" disabled={Boolean(pendingAction)} onClick={() => { setPhotoView({ visitId: "", index: 0 }); setSelectedId(undefined); setSelectedAnchor(undefined); }} aria-label="상세 닫기"><X size={18} /></button>
          </div>
          <div className="sheet-body" id="visit-detail-body">
          {activePhotoUrl && <div className="sheet-photo" onTouchStart={(event) => { photoTouchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const start = photoTouchStartX.current; const end = event.changedTouches[0]?.clientX; photoTouchStartX.current = null; if (start === null || end === undefined || Math.abs(start - end) < 42) return; showPhoto(start > end ? 1 : -1); }}>
            <img key={activePhotoUrl} src={activePhotoUrl} alt={`${selected.place.name} 방문 사진 ${activePhotoIndex + 1}/${selected.photoUrls.length}`} draggable={false} />
            <span className="sheet-photo-label">방문 사진</span>
            {selected.photoUrls.length > 1 && <>
              <button className="sheet-photo-nav previous" type="button" onClick={() => showPhoto(-1)} aria-label="이전 사진"><ChevronLeft size={21} /></button>
              <button className="sheet-photo-nav next" type="button" onClick={() => showPhoto(1)} aria-label="다음 사진"><ChevronRight size={21} /></button>
              <span className="sheet-photo-count" aria-live="polite">{activePhotoIndex + 1} / {selected.photoUrls.length}</span>
            </>}
          </div>}
          <div className="sheet-content"><div className="sheet-date"><span>{formatDate(selected.visitedOn)}</span><span>{selected.place.category}</span></div><h2>{selected.place.name}</h2><p className="sheet-address"><MapPin size={15} />{selected.place.address || "직접 지정한 위치"}</p><div className="sheet-rating" aria-label={`별점 ${formatRating(selected.rating)}점, 5점 만점`}><SquareSparkIcon className="rating-square-spark" /><strong>{formatRating(selected.rating)}</strong><span>/5.0</span></div><h3>{selected.title}</h3><p className="sheet-note">{selected.note}</p><div className="sheet-tags">{selected.tags.map((item) => <span key={item}>#{item}</span>)}</div><div className="sheet-footer"><div className="participants">{selected.participants.map((person) => <span key={person.id} title={person.displayName}>{person.initials}</span>)}<small>함께</small></div><div className="sheet-actions"><button disabled={Boolean(pendingAction)} onClick={() => openEdit(selected)}>기록 고치기</button><button className="danger-button" disabled={Boolean(pendingAction)} onClick={() => deleteVisit(selected)}>{pendingAction === "delete" ? "삭제 중…" : "기록 삭제"}</button></div></div></div>
          </div>
        </article>}
        {notice && <button className="notice" onClick={() => setNotice("")} aria-live="polite">{notice}<X size={14} /></button>}
        <nav className="mobile-nav" aria-label="모바일 주요 메뉴">
          <button className={!mobileList && !manualMode ? "active" : ""} aria-current={!mobileList && !manualMode ? "page" : undefined} type="button" onClick={() => { setMobileList(false); setManualMode(false); setSelectedId(undefined); setSelectedAnchor(undefined); }}><MapIcon size={21} />지도</button>
          <button type="button" onClick={() => openMobileList()}><List size={21} />기록</button>
          <button className={manualMode ? "active" : ""} aria-pressed={manualMode} type="button" onClick={() => manualMode ? setManualMode(false) : startManualPin()}>{manualMode ? <X size={23} /> : <Plus size={23} />}{manualMode ? "추가 취소" : "추가"}</button>
          <button type="button" onClick={() => openMobileList("groups")}><Users size={21} />그룹</button>
        </nav>
      </section>

      <InstallAppButton autoPrompt suppressAutoPrompt={Boolean(selected || draftPlace || manualMode || mobileList)} />

      <dialog ref={dialogRef} className="visit-dialog" aria-label={editing ? "기록 고치기" : "새 방문 기록"} onCancel={(event) => { if (pendingAction) event.preventDefault(); }} onClose={() => { setDraftPlace(null); setEditing(null); setFormError(""); setPulseLocation(undefined); }}>
        <form method="dialog" className="dialog-close-form"><button disabled={Boolean(pendingAction)} aria-label="창 닫기"><X size={20} /></button></form>
        {formError && <p className="visit-form-error" role="alert">{formError}</p>}
        {draftPlace && (
          <form className="visit-form" onSubmit={saveVisit}>
            {pendingAction === "save" && <div className="operation-progress" role="progressbar" aria-label={editing ? "기록 수정 중" : "기록 저장 중"} />}
            <div className="form-title">
              <MapPin size={22} />
              <div><span>{editing ? "기록 고치기" : "새 방문 기록"}</span><h2>{draftPlace.name || "이 위치에 이름을 붙여주세요"}</h2></div>
            </div>
            <div className="form-grid">
              <label>장소 이름<input name="placeName" defaultValue={draftPlace.name} required /></label>
              <label>방문한 날<input name="visitedOn" type="date" defaultValue={editing?.visitedOn ?? new Date().toISOString().slice(0, 10)} required /></label>
            </div>
            <label className="planned-toggle"><input name="isPlanned" type="checkbox" defaultChecked={editing?.isPlanned ?? false} /><span><strong>방문 예정</strong><small>아직 방문하지 않은 장소로 표시</small></span></label>
            <label>주소 또는 위치 설명<input name="address" defaultValue={draftPlace.address} placeholder="예: 해방촌 골목 안쪽" /></label>
            <fieldset className="marker-picker">
              <legend>지도에 표시할 핀</legend>
              <div>{MARKER_STYLE_IDS.map((style, index) => <label key={style} className={markerStyle === style ? "selected" : undefined} title={`핀 ${index + 1}`}><input type="radio" name="markerStyle" value={style} checked={markerStyle === style} onChange={() => setMarkerStyle(style)} aria-label={`핀 ${index + 1}`} /><img src={markerSvgDataUrl(style)} alt="" /><Check size={14} strokeWidth={3} aria-hidden="true" /></label>)}</div>
            </fieldset>
            <label>기록 제목<input name="title" defaultValue={editing?.title} placeholder="그날을 한 문장으로" required /></label>
            <label>무엇을 했나요?<textarea name="note" defaultValue={editing?.note} rows={4} placeholder="먹은 것, 나눈 이야기, 다시 오고 싶은 이유…" /></label>
            <div className="form-grid">
              <RatingPicker defaultValue={editing?.rating ?? 5} />
              <label>태그<input name="tags" defaultValue={editing?.tags.join(", ")} placeholder="데이트, 산책, 맛집" /></label>
            </div>
            <fieldset>
              <legend>함께한 사람</legend>
              <div className="member-checks">{initialData.members.map((member) => <label key={member.id}><input type="checkbox" name={`member-${member.id}`} defaultChecked={editing ? editing.participants.some((person) => person.id === member.id) : true} /><span className="member-avatar">{member.initials}</span><span className="member-name">{member.displayName}</span><Check className="member-checkmark" size={13} strokeWidth={3} aria-hidden="true" /></label>)}</div>
            </fieldset>
            <label className="photo-input"><Camera size={20} /><span><strong>사진 추가</strong><small>최대 5장 · 사진당 약 350KB로 자동 압축</small></span><input name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple /></label>
            <div className="form-actions"><button type="button" disabled={Boolean(pendingAction)} onClick={() => dialogRef.current?.close()}>취소</button><button className="primary-button" disabled={Boolean(pendingAction)} type="submit">{pendingAction === "save" ? (editing ? "수정 중…" : "저장 중…") : editing ? "수정 내용 저장" : "지도에 기록 남기기"}</button></div>
          </form>
        )}
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
