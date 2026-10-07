"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { CalendarDays, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Filter, Globe2, List, LocateFixed, LogOut, Map as MapIcon, MapPin, Menu, Palette, Plus, Search, Trash2, Users, X, ZoomIn } from "lucide-react";
import { KakaoMap, type MapAnchor } from "@/components/kakao-map";
import { TripPlanner } from "@/components/trip-planner";
import { GroupOnboarding } from "@/components/group-onboarding";
import { InstallAppButton } from "@/components/install-app-button";
import { FontPicker } from "@/components/font-preference";
import { RatingPicker } from "@/components/rating-picker";
import { SquareSparkIcon } from "@/components/square-spark-icon";
import { Field, FieldLabel, FieldGroup, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { QuickFilters } from "@/components/quick-filters";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Brand } from "@/components/brand";
import { WorkspacePicker } from "@/components/workspace-picker";
import { TrashDialog } from "@/components/trash-dialog";
import { useConfirmation } from "@/components/confirmation";
import { clearDraft, clearUserDrafts, formValues, listDrafts, saveDraft, type SavedDraft } from "@/lib/drafts";
import { EMPTY_FILTERS, filterVisits, type VisitFilters } from "@/lib/visit-filter";
import { Badge } from "@/components/ui/badge";
import { prepareVisitImage } from "@/lib/images";
import { useVisitDraft, type VisitDraftData } from "@/lib/use-visit-draft";
import { usePhotoViewer } from "@/lib/use-photo-viewer";
import { useVisitStore } from "@/lib/use-visit-store";
import { usePlaceSearch } from "@/lib/use-place-search";
import { apiRequest, jsonRequest } from "@/lib/api-request";
import { DEFAULT_MARKER_STYLE, MARKER_PICKER_STYLE_IDS as MARKER_STYLE_IDS, markerSvgDataUrl, normalizeMarkerStyle, type MarkerStyle } from "@/lib/marker-styles";

const markerSvgData = markerSvgDataUrl;
const formatRating = (rating: number) => rating.toFixed(1);
import { getMemberInitials } from "@/lib/member-initials";
import { DEFAULT_THEME, normalizeTheme, THEME_OPTIONS, type ThemeId } from "@/lib/themes";
import { visitSchema } from "@/lib/schemas";
import type { DashboardData } from "@/lib/data";
import type { Group, Place, Visit } from "@/types/domain";

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
  const confirmation = useConfirmation();
  const userKey = viewerId ?? "demo";
  const [filters, setFilters] = useState<VisitFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterStorageReady=useRef(false);
  const [searchMode, setSearchMode] = useState<"places" | "records">("places");
  const [online, setOnline] = useState(true);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashLoading,setTrashLoading]=useState(false);
  const [trashError,setTrashError]=useState("");
  const [photoError,setPhotoError]=useState("");
  const [trash, setTrash] = useState<Array<{ id: string; title: string; version: number; deleted_at: string; places?: { name: string } }>>([]);
  const [undo, setUndo] = useState<Visit>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [visitConflict, setVisitConflict] = useState(false);
  const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});

  const [activeGroupId, setActiveGroupId] = useState(initialData.groups[0]?.id ?? "");
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerVisit, setPlannerVisit] = useState<Visit>();
  const [storageReady, setStorageReady] = useState(() => !initialData.demoMode);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [selectedAnchor, setSelectedAnchor] = useState<MapAnchor>();
  const [selectionRequest, setSelectionRequest] = useState(0);
  const [popupPosition, setPopupPosition] = useState<PopupPosition>();
  const [pendingAction, setPendingAction] = useState<"save" | "delete">();
  const [query, setQuery] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [mapProvider, setMapProvider] = useState<MapProvider>("kakao");
  const tag = filters.status === "planned" && !filters.tags.length ? "방문 예정" : filters.tags.length === 1 ? filters.tags[0] : "전체";
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
  const { visitDrafts, setVisitDrafts, restoredFields, setRestoredFields, draftKey, setDraftKey, photoRetry, setPhotoRetry, requestIdRef, photoRequestsRef, draftTimer, writeDraftNow } = useVisitDraft(userKey, activeGroupId, draftPlace);
  const groupSaving = useRef(false);
  const groupRequestId = useRef("");
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupError, setGroupError] = useState("");
  const { visits, setVisits, groups, setGroups, members, refresh: refreshVisits, error: dataError, photoWarning, loading: dataLoading } = useVisitStore(initialData, activeGroupId, Boolean(pendingAction || photoBusy || groupBusy), userKey);
  const { results: searchResults, setResults: setSearchResults, message: searchMessage, setMessage: setSearchMessage, searching, search, cancel: cancelSearch } = usePlaceSearch(query, mapProvider, activeGroupId, visits, !plannerOpen && !draftPlace && searchMode === "places");
  const { setLightbox, lightboxRef, lightboxOffset, setLightboxOffset, lightboxAspect, setLightboxAspect, lightboxDrag, photoView, setPhotoView, moveLightbox, showPhoto } = usePhotoViewer(visits, selectedId);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number }>();
  const [mapFocus, setMapFocus] = useState<{ latitude: number; longitude: number }>();
  const [maxZoomRequest, setMaxZoomRequest] = useState<{ latitude: number; longitude: number; request: number }>();
  const [pulseLocation, setPulseLocation] = useState<{ latitude: number; longitude: number }>();
  const [selectedDateKey, setSelectedDateKey] = useState<string | undefined>();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const groupDialogRef = useRef<HTMLDialogElement>(null);
  const mapStageRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const groupMenuButtonRef = useRef<HTMLButtonElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const sidebarOpener = useRef<HTMLElement | null>(null);
  const photoTouchStartX = useRef<number | null>(null);
  const closeGroupMenu = useCallback(() => {
    setGroupMenu(false);
    setThemePickerOpen(false);
  }, [setGroupMenu, setThemePickerOpen]);

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

  useEffect(() => {
    if (!groupMenu) return;

    const isInsideGroupMenu = (target: EventTarget | null) => (
      target instanceof Node
      && (groupMenuButtonRef.current?.contains(target) || groupMenuRef.current?.contains(target))
    );
    const handlePointerDown = (event: PointerEvent) => {
      if (!isInsideGroupMenu(event.target)) closeGroupMenu();
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (!isInsideGroupMenu(event.target)) closeGroupMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeGroupMenu();
      groupMenuButtonRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeGroupMenu, groupMenu]);

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
  }, [initialData.demoMode, setGroups, setVisits]);

  useEffect(() => {
    if (!initialData.demoMode || !storageReady) return;
    window.localStorage.setItem(VISITS_STORAGE_KEY, JSON.stringify(visits));
    window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  }, [groups, initialData.demoMode, storageReady, visits]);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine); sync(); window.addEventListener("online", sync); window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);

  useEffect(() => {
    filterStorageReady.current=false;
    const timer=setTimeout(() => { try { const saved=JSON.parse(localStorage.getItem(userKey+":record-view:"+activeGroupId) ?? "null"); setFilters(saved?.filters ? {...EMPTY_FILTERS,...saved.filters} : EMPTY_FILTERS);  setSearchMode(saved?.mode==="records" ? "records" : "places"); } catch { setFilters(EMPTY_FILTERS); } filterStorageReady.current=true; },0);
    return () => clearTimeout(timer);
  },[userKey,activeGroupId]);
  useEffect(() => { if (filterStorageReady.current) { try { localStorage.setItem(userKey+":record-view:"+activeGroupId,JSON.stringify({filters,mode:searchMode})); } catch {} } },[userKey,activeGroupId,filters,tag,searchMode]);
  useEffect(() => { if (!undo) return; const timer = setTimeout(() => setUndo(undefined), 10000); return () => clearTimeout(timer); }, [undo]);

  function persistVisitForm(form: HTMLFormElement) {
    if (!draftPlace) return;
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
    const key = draftKey || userKey + ":visit:" + activeGroupId + ":" + (editing?.id ?? "new");
    const data = { place: draftPlace, editing, fields: formValues(form), markerStyle, photoRequests: photoRequestsRef.current, requestId: requestIdRef.current, hadPhotos: Boolean((form.elements.namedItem("photos") as HTMLInputElement)?.files?.length || photoRetry) };
    writeDraftNow.current = () => saveDraft(key, data);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => { writeDraftNow.current?.(); }, 500);
  }
  function resumeVisit(saved: SavedDraft<VisitDraftData>) {
    requestIdRef.current = saved.data.requestId; photoRequestsRef.current=saved.data.photoRequests ?? []; setDraftKey(saved.key); setRestoredFields(saved.data.fields); setMarkerStyle(saved.data.markerStyle); setEditing(saved.data.editing); setDraftPlace(saved.data.place); setFormError(saved.data.hadPhotos ? "초안을 복원했습니다. 업로드하지 않은 사진은 다시 선택해 주세요." : ""); setMobileList(false); dialogRef.current?.showModal();
  }
  function discardVisitDraft(key: string) { clearDraft(key); setVisitDrafts(current => current.filter(draft => draft.key !== key)); }
  async function openTrash() {
    closeGroupMenu(); setTrashError(""); setTrashLoading(!initialData.demoMode); setTrash([]); setTrashOpen(true); setMobileList(false);
    if (initialData.demoMode) { setTrash(visits.filter(visit => visit.groupId === activeGroupId && visit.deletedAt && Date.now()-Date.parse(visit.deletedAt)<30*86400000).map(visit => ({ id: visit.id, title: visit.title, version: visit.version, deleted_at: visit.deletedAt!, places: { name: visit.place.name } }))); return; }
    try { const data = await apiRequest<{visits: typeof trash}>("/api/visits/trash?groupId=" + activeGroupId); setTrash(data.visits); } catch (error) { setTrashError((error as Error).message); } finally { setTrashLoading(false); }
  }
  async function restoreVisit(id: string, version: number) {
    try {
      if (!initialData.demoMode) { await apiRequest("/api/visits/restore", jsonRequest("POST", { id, version })); void refreshVisits(); }
      else setVisits(current => current.map(visit => visit.id === id ? { ...visit, deletedAt: null, version: visit.version+1 } : visit));
      setTrashError(""); setTrash(current => current.filter(visit => visit.id !== id)); setUndo(undefined); setNotice("기록과 사진을 복원했습니다.");
    } catch (error) { setNotice((error as Error).message); setTrashError((error as Error).message); }
  }
  async function deletePhoto() {
    if (!selected || !activePhotoUrl || photoBusy || !await confirmation.confirm("이 사진을 기록에서 삭제할까요?")) return;
    setPhotoError(""); setPhotoBusy(true);
    try {
      if (!initialData.demoMode) { await apiRequest("/api/visits/" + selected.id + "/photos", jsonRequest("DELETE", { photoId: selected.photoIds?.[activePhotoIndex] })); }
      setVisits(current => current.map(visit => visit.id === selected.id ? { ...visit, photoUrls: visit.photoUrls.filter((_,index) => index !== activePhotoIndex), photoIds: visit.photoIds?.filter((_,index) => index !== activePhotoIndex) } : visit));
      if (selected.photoUrls.length === 1) { lightboxRef.current?.close(); setLightbox(false); } setNotice("사진을 삭제했습니다.");
    } catch (error) { setPhotoError((error as Error).message); } finally { setPhotoBusy(false); }
  }
  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0];
  const groupVisits = useMemo(() => filterVisits(visits.filter(visit => visit.groupId === activeGroupId), filters), [activeGroupId, filters, visits]);
  const dateGroups = useMemo(() => {
    if (filters.sort === "rating") return groupVisits.length ? [{ date: "rating", visits: groupVisits }] : [];
    const grouped = new Map<string, Visit[]>();
    groupVisits.forEach((visit) => grouped.set(visit.visitedOn, [...(grouped.get(visit.visitedOn) ?? []), visit]));
    return Array.from(grouped, ([date, dateVisits]) => ({ date, visits: dateVisits }));
  }, [groupVisits, filters.sort]);
  const highlightedIds = useMemo(() => dateGroups.find((group) => group.date === selectedDateKey)?.visits.map((visit) => visit.id) ?? [], [dateGroups, selectedDateKey]);
  const allTags = useMemo(() => ["전체", "방문 예정", ...Array.from(new Set(visits.filter(visit => visit.groupId===activeGroupId && !visit.deletedAt).flatMap((visit) => visit.tags))).slice(0, 4)], [visits, activeGroupId]);
  const selected = groupVisits.find((visit) => visit.id === selectedId);
  const activeFilters = [
    ...(filters.query ? [{ label: `검색: ${filters.query}`, remove: () => setFilters(current => ({ ...current, query: "" })) }] : []),
    ...(filters.from ? [{ label: `시작: ${filters.from}`, remove: () => setFilters(current => ({ ...current, from: "" })) }] : []),
    ...(filters.to ? [{ label: `종료: ${filters.to}`, remove: () => setFilters(current => ({ ...current, to: "" })) }] : []),
    ...(filters.status !== "all" ? [{ label: filters.status === "planned" ? "방문 예정" : "방문 완료", remove: () => setFilters(current => ({ ...current, status: "all" })) }] : []),
    ...filters.tags.map(value => ({ label: `태그: ${value}`, remove: () => setFilters(current => ({ ...current, tags: current.tags.filter(tag => tag !== value) })) })),
    ...filters.participants.map(id => ({ label: `참여자: ${members.find(person => person.id === id)?.displayName ?? "멤버"}`, remove: () => setFilters(current => ({ ...current, participants: current.participants.filter(person => person !== id) })) }))
  ];
  const activePhotoIndex = selected && photoView.visitId === selected.id ? Math.min(photoView.index, Math.max(0, selected.photoUrls.length - 1)) : 0;
  const activePhotoUrl = selected?.photoUrls[activePhotoIndex];
  const mapSummary = groupVisits.length ? `장소 ${new Set(groupVisits.map(visit => visit.place.id)).size}곳 · 방문 ${groupVisits.length}회` : "첫 장소를 남겨보세요";
  const canManageActiveGroup = initialData.demoMode ? activeGroup?.ownerId === viewerId : activeGroup?.role === "owner";
  const sheetStyle: PopupStyle | undefined = popupPosition ? {
    left: popupPosition.left,
    top: popupPosition.top,
    "--tail-x": `${popupPosition.tailX}px`,
    "--tail-y": `${popupPosition.tailY}px`,
    "--tail-length": `${popupPosition.tailLength}px`,
  } : undefined;

  useEffect(() => { const timer = setTimeout(() => { if (!groups.some(group => group.id === activeGroupId)) setActiveGroupId(groups[0]?.id ?? ""); }, 0); return () => clearTimeout(timer); }, [groups, activeGroupId]);

  const handleAnchorChange = useCallback((anchor?: MapAnchor) => {
    setSelectedAnchor(anchor);
    if (!anchor) setPopupPosition(undefined);
  }, [setSelectedAnchor]);

  const handlePopupDismiss = useCallback(() => {
    setSelectedAnchor(undefined);
    setPopupPosition(undefined);
  }, [setSelectedAnchor]);

  const handleVisitSelect = useCallback((visit: Visit) => {
    setNotice("");
    setMapFocus(undefined);
    setPulseLocation(undefined);
    setSheetExpanded(false);
    setPhotoView({ visitId: visit.id, index: 0 });
    setSelectedId(visit.id);
    setSelectedAnchor(undefined);
    setSelectionRequest((request) => request + 1);
  }, [setNotice, setPulseLocation, setSheetExpanded, setPhotoView, setSelectedId, setSelectedAnchor]);

  useEffect(() => {
    if (!selectedId) return;
    const dismissOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (lightboxRef.current?.open || (target instanceof Element && target.closest("dialog"))) return;
      if (target instanceof Node && sheetRef.current?.contains(target)) return;
      setSelectedId(undefined);
      setSelectedAnchor(undefined);
      setPopupPosition(undefined);
    };
    document.addEventListener("pointerdown", dismissOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", dismissOnOutsidePointer, true);
  }, [selectedId, lightboxRef]);

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
  function zoomToVisit(visit: Visit) {
    setMaxZoomRequest((current) => ({ latitude: visit.place.latitude, longitude: visit.place.longitude, request: (current?.request ?? 0) + 1 }));
  }

  function chooseGroup(groupId: string) {
    setMapFocus(undefined);
    setPulseLocation(undefined);
    setActiveGroupId(groupId);

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

  async function searchPlaces(event: React.FormEvent) { event.preventDefault(); await search(); }

  function changeMapProvider(nextProvider: MapProvider) {
    if (nextProvider === mapProvider) return;
    cancelSearch();
    setMapProvider(nextProvider);
    window.localStorage.setItem(MAP_PROVIDER_STORAGE_KEY, nextProvider);
    setSelectedId(undefined);
    setSelectedAnchor(undefined);
    setMapFocus(undefined);
    setMaxZoomRequest(undefined);
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
  }, [setSelectedId, setSelectedAnchor, setPulseLocation, setNotice, setFormError, setDraftPlace, setEditing, setManualMode, setSearchResults]);

  function persistSavedVisit(visit: Visit, hadPhotos: boolean) {
    const form=dialogRef.current?.querySelector<HTMLFormElement>("form.visit-form"); if (!form) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    const key=draftKey || userKey+":visit:"+activeGroupId+":new";
    const data: VisitDraftData={ place:visit.place, editing:visit, fields:formValues(form), markerStyle:visit.markerStyle, requestId:crypto.randomUUID(), hadPhotos, photoRequests:photoRequestsRef.current };
    requestIdRef.current=data.requestId; writeDraftNow.current=()=>saveDraft(key,data); writeDraftNow.current();
  }
  async function uploadVisitPhotos(visit: Visit, files: Array<{ id: string; file: File }>) {
    const form = new FormData(); files.forEach(item => form.append("photos", item.file, item.file.name)); form.append("photoIds", JSON.stringify(files.map(item => item.id)));
    const data = await apiRequest<{results: Array<{fileId: string; photoId?: string; url?: string; error?: string}>}>("/api/visits/" + visit.id + "/photos", { method: "POST", body: form });
    const successes = (data.results as Array<{ fileId: string; photoId?: string; url?: string; error?: string }>).filter(item => !item.error && item.url);
    const next = { ...visit, photoUrls: [...visit.photoUrls], photoIds: [...(visit.photoIds ?? [])] };
    for (const result of successes) if (result.photoId && !next.photoIds.includes(result.photoId)) { next.photoIds.push(result.photoId); next.photoUrls.push(result.url!); }
    setVisits(current => current.map(item => item.id === next.id ? next : item)); setEditing(next);
    const remaining = files.filter(item => !successes.some(result => result.fileId === item.id));
    photoRequestsRef.current=photoRequestsRef.current.filter(item => remaining.some(file => file.id===item.id)); persistSavedVisit(next, Boolean(remaining.length));
    setPhotoRetry(remaining.length ? { visit: next, files: remaining } : undefined);
    if (remaining.length) setFormError("기록은 저장되었습니다. 실패한 사진을 다시 올려주세요.");
    return !remaining.length;
  }
  async function retryPhotos() {
    if (!photoRetry || pendingAction) return;
    setPendingAction("save");
    try { if (await uploadVisitPhotos(photoRetry.visit, photoRetry.files)) { finishVisitSave(); setNotice("사진까지 모두 저장했습니다."); } } catch (error) { setFormError("기록은 저장되었습니다. 실패한 사진을 다시 올려주세요. "+(error as Error).message); } finally { setPendingAction(undefined); }
  }
  function finishVisitSave() {
    if (draftTimer.current) clearTimeout(draftTimer.current); writeDraftNow.current = null; photoRequestsRef.current=[];
    clearDraft(draftKey || userKey + ":visit:" + activeGroupId + ":" + (editing?.id ?? "new")); clearDraft(userKey + ":visit:" + activeGroupId + ":new");
    dialogRef.current?.close();
  }
  async function saveVisit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!draftPlace || !activeGroup || pendingAction || photoRetry) return;
    const form = new FormData(event.currentTarget); const formElement = event.currentTarget;
    const files = form.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0);
    const participantIds = members.filter(member => form.get("member-" + member.id) === "on").map(member => member.id);
    const raw = { id: editing?.id, groupId: activeGroup.id, place: { ...draftPlace, name: String(form.get("placeName") ?? draftPlace.name), address: String(form.get("address") ?? draftPlace.address) }, visitedOn: String(form.get("visitedOn")), isPlanned: form.get("isPlanned") === "on", title: String(form.get("title")), note: String(form.get("note")), rating: Number(form.get("rating")), tags: String(form.get("tags") ?? "").split(",").map(item => item.trim()).filter(Boolean).slice(0,8), participantIds, markerStyle, version: editing?.version ?? 1 };
    const parsed = visitSchema.safeParse(raw); if (!parsed.success) { setFieldErrors(Object.fromEntries(parsed.error.issues.map(issue => [issue.path[0]==="tags" ? "tags" : issue.path.join("."),issue.message]))); return setFormError("입력 항목을 확인해 주세요."); }
    if (files.length + (editing?.photoUrls.length ?? 0)>5) return setFormError("사진은 기존 사진과 합쳐 최대 5장입니다.");
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
    persistVisitForm(formElement); setPendingAction("save"); setFormError("");
    let recordSaved=false;
    try {
      const requests = files.map(file => ({ id: photoRequestsRef.current.find(item => item.name===file.name && item.size===file.size && item.modified===file.lastModified)?.id ?? crypto.randomUUID(), name:file.name, size:file.size, modified:file.lastModified }));
      photoRequestsRef.current=requests;
      persistVisitForm(formElement); writeDraftNow.current?.();
      const prepared = await Promise.all(files.map(async (file,index) => ({ id: requests[index].id, file: await prepareVisitImage(file) })));
      let id = editing?.id ?? requestIdRef.current; let version = editing?.version ?? 1; let placeId = draftPlace.id;
      if (!initialData.demoMode) { try { const data = await apiRequest<{id: string; version: number; placeId?: string}>("/api/visits", jsonRequest(editing ? "PUT" : "POST", { ...parsed.data, requestId: requestIdRef.current })); id=data.id; version=data.version; placeId=data.placeId ?? placeId; } catch(error) { if ((error as {status?: number}).status === 409) { setVisitConflict(true); void refreshVisits(false,true); } throw error; } }
      const next: Visit = { id, groupId: activeGroup.id, place: { ...parsed.data.place, id: placeId }, visitedOn: parsed.data.visitedOn, isPlanned: parsed.data.isPlanned, title: parsed.data.title, note: parsed.data.note, rating: parsed.data.rating, tags: parsed.data.tags, participants: members.filter(member => participantIds.includes(member.id)), photoUrls: editing?.photoUrls ?? [], photoIds: editing?.photoIds ?? [], markerStyle, version, updatedBy: viewerName ?? "나" };
      recordSaved=true; setVisits(current => [next, ...current.filter(item => item.id !== id)]); setEditing(next); setSelectedId(id); setSelectedDateKey(next.visitedOn); setSelectedAnchor(undefined); setSelectionRequest(value => value+1);
      if (prepared.length && !initialData.demoMode) {
        persistSavedVisit(next, true); setPhotoRetry({ visit: next, files: prepared }); (formElement.elements.namedItem("photos") as HTMLInputElement).value="";
        if (!await uploadVisitPhotos(next,prepared)) return;
      } else if (prepared.length) { const withPhotos={ ...next, photoUrls:[...next.photoUrls,...prepared.map(item => URL.createObjectURL(item.file))], photoIds:[...(next.photoIds ?? []),...prepared.map(item => item.id)] }; setVisits(current => current.map(item => item.id===id ? withPhotos : item)); }
      setNotice("기록을 저장했습니다."); finishVisitSave();
    } catch (error) { setFormError((recordSaved ? "기록은 저장되었습니다. 실패한 사진을 다시 올려주세요. " : "")+(error as Error).message); } finally { setPendingAction(undefined); }
  }
  async function deleteVisit(visit: Visit) {
    if (pendingAction || !await confirmation.confirm(`“${visit.place.name}” 방문 기록을 삭제할까요? 30일 안에 복원할 수 있어요.`)) return;
    setPendingAction("delete");
    setMapFocus(undefined);
    setPulseLocation(undefined);
    try {
      if (!initialData.demoMode) {
        await apiRequest("/api/visits", jsonRequest("DELETE", { id: visit.id, version: visit.version }));
      }
      setVisits((current) => current.map(item => item.id === visit.id ? { ...item, deletedAt: new Date().toISOString(), version: item.version+1 } : item));
      for (const saved of listDrafts<VisitDraftData>(userKey+":visit:"+activeGroupId+":")) if (saved.data.editing?.id===visit.id) clearDraft(saved.key);
      setVisitDrafts(current=>current.filter(saved=>saved.data.editing?.id!==visit.id));
      setUndo({ ...visit, version: visit.version+1 });
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
    setNewGroupName(""); setGroupError(""); groupRequestId.current = crypto.randomUUID();
    groupDialogRef.current?.showModal();
  }

  async function createGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (groupSaving.current) return;
    const name = newGroupName.trim();
    if (name.length < 2) return setGroupError("지도 이름을 두 글자 이상 입력해 주세요.");
    groupSaving.current = true; setGroupBusy(true); setGroupError("");
    try {
    let group: Group = { id: crypto.randomUUID(), name, role: "owner", memberCount: 4, ownerId: viewerId };
    let creationNotice = `“${name}” 지도를 만들었습니다. 등록된 네 명에게 자동 공유됩니다.`;
    if (!initialData.demoMode) {
      try {
        const data = await apiRequest<{group: Group; notice?: string}>("/api/groups", jsonRequest("POST", { name, requestId: groupRequestId.current || (groupRequestId.current = crypto.randomUUID()) }));
        group = data.group as Group;
        if (data.notice) creationNotice = data.notice;
      } catch (error) {
        return setGroupError(error instanceof Error ? error.message : "지도를 만들지 못했습니다.");
      }
    }
    setGroups((current) => [...current.filter(item => item.id !== group.id), group]);
    setActiveGroupId(group.id);
    setSelectedId(undefined);
    setSelectedDateKey(undefined);
    setNotice(creationNotice);
    groupDialogRef.current?.close();
    } finally { groupSaving.current = false; setGroupBusy(false); }
  }

  async function deleteGroup() {
    if (!activeGroup || !canManageActiveGroup) return setNotice("이 지도는 만든 사람만 삭제할 수 있어요.");
    if (groups.length <= 1) return setNotice("마지막 지도는 삭제할 수 없어요. 새 지도를 만든 뒤 다시 시도해 주세요.");
    const visitCount = visits.filter((visit) => visit.groupId === activeGroup.id).length;
    if (!await confirmation.confirm(`“${activeGroup.name}” 지도와 방문 기록 ${visitCount}개를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;

    try {
      if (!initialData.demoMode) {
        await apiRequest(`/api/groups/${activeGroup.id}`, { method: "DELETE" });
      }
      const nextGroups = groups.filter((group) => group.id !== activeGroup.id);
      setGroups(nextGroups);
      setVisits((current) => current.filter((visit) => visit.groupId !== activeGroup.id));
      setActiveGroupId(nextGroups[0]?.id ?? "");

      setSelectedId(undefined);
      setSelectedDateKey(undefined);
      setGroupMenu(false);
      setNotice(`“${activeGroup.name}” 지도를 삭제했습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "지도를 삭제하지 못했습니다.");
    }
  }

  async function logout() {
    try {
      await apiRequest("/api/access/logout", { method: "POST" });
      if (draftTimer.current) clearTimeout(draftTimer.current);
      writeDraftNow.current = null;
      clearUserDrafts(userKey); setVisits([]); setGroups([]); router.replace("/login"); router.refresh();
    } catch(error) { setNotice((error as Error).message); }
  }

  function locateMe() {
    if (!navigator.geolocation) return setNotice("이 브라우저에서는 현재 위치를 사용할 수 없습니다.");
    setNotice("현재 위치를 찾고 있습니다…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setCurrentLocation({ latitude: coords.latitude, longitude: coords.longitude }); setNotice("현재 위치로 지도를 옮겼습니다."); },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) return setNotice("브라우저의 위치 권한이 차단되어 있어요. 사이트 설정에서 위치를 허용한 뒤 다시 눌러 주세요.");
        if (error.code === error.POSITION_UNAVAILABLE) return setNotice("현재 위치를 확인하지 못했어요. GPS나 네트워크를 켜고 다시 시도해 주세요.");
        setNotice("위치를 찾는 데 시간이 걸리고 있어요. 잠시 후 다시 시도해 주세요.");
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
    );
  }

  if (!groups.length) return dataError ? <main className="dashboard-error"><h1>{dataError}</h1><Button onClick={() => router.replace("/login")}>로그인으로</Button></main> : <GroupOnboarding />;

  if (plannerOpen) return <main className="journal-app planner-app" data-theme={theme}><TripPlanner viewerId={userKey} key={activeGroupId} groupId={activeGroupId} groups={groups} visits={visits} demo={initialData.demoMode} initialVisit={plannerVisit?.groupId === activeGroupId ? plannerVisit : undefined} onGroup={chooseGroup} onClose={() => { setPlannerOpen(false); setPlannerVisit(undefined); }} /></main>;

  return (
    <main className="journal-app" data-theme={theme}>
      {mobileList && <div className="sidebar-backdrop" aria-hidden="true" onClick={() => { setMobileList(false); closeGroupMenu(); }} />}
      <aside ref={sidebarRef} id="journal-sidebar" className={`journal-sidebar ${mobileList ? "mobile-open" : ""}`} inert={isMobile && !mobileList} role={isMobile && mobileList ? "dialog" : undefined} aria-modal={isMobile && mobileList ? true : undefined} aria-label="기록 목록과 장소 검색">
        <header className="sidebar-header"><Brand compact /><button className="icon-button mobile-close" onClick={() => setMobileList(false)} aria-label="목록 닫기"><X size={20} /></button></header>
        <div className="group-row"><label id="group-label">함께 보는 지도</label><WorkspacePicker label="함께 보는 지도 선택" value={activeGroupId} options={groups.map(group => ({ value: group.id, label: group.name, detail: (group.id === activeGroupId && !dataLoading ? visits.filter(visit => visit.groupId === group.id && !visit.deletedAt).length : group.visitCount ?? 0) + "건" }))} onChange={chooseGroup} open={groupPickerOpen} onOpenChange={setGroupPickerOpen} action={{ label: "함께 보는 지도 추가", onClick: openCreateGroup }} /></div>
        <nav className="journal-view-switch" aria-label="지도 보기 방식"><button aria-pressed="true">기록</button><button onClick={() => { setPlannerVisit(undefined); setPlannerOpen(true); setMobileList(false); }}>여행 계획</button></nav><div className="record-search-controls"><ToggleGroup type="single" value={searchMode} onValueChange={value => { if (value === "places" || value === "records") setSearchMode(value); }} aria-label="검색 대상"><ToggleGroupItem value="places">새로운 장소</ToggleGroupItem><ToggleGroupItem value="records">저장된 기록</ToggleGroupItem></ToggleGroup></div>{searchMode === "records" && <div className="record-query"><Input aria-label="저장된 기록 검색" placeholder="장소, 제목, 메모, 주소" value={filters.query} onChange={event => setFilters(current => ({ ...current, query: event.target.value }))} /><Button variant="outline" onClick={() => setFiltersOpen(value => !value)} aria-expanded={filtersOpen}><Filter />상세 필터</Button></div>}<div className="search-area" hidden={searchMode !== "places"}><form className="place-search" role="search" onSubmit={searchPlaces}><Search size={19} aria-hidden="true" /><input ref={searchInputRef} type="search" enterKeyHint="search" value={query} onChange={(event) => { setQuery(event.target.value); setSearchResults([]); setSearchMessage(""); }} placeholder={mapProvider === "osm" ? "도시, 명소, 주소로 해외 검색" : "장소 이름으로 국내 검색"} aria-label="장소 검색" autoComplete="off" /><button type="submit" disabled={searching}>{searching ? "찾는 중" : "찾기"}</button></form>{(searchResults.length > 0 || searchMessage) && <div className="search-popover" aria-live="polite">{searchResults.map((result) => <button key={result.id} type="button" onClick={() => openForPlace(result.existingPlace ?? { id: crypto.randomUUID(), provider: mapProvider === "osm" ? "manual" : "kakao", providerPlaceId: mapProvider === "kakao" ? result.id : undefined, name: result.placeName, address: result.roadAddressName || result.addressName, category: result.categoryName, latitude: result.latitude, longitude: result.longitude })}><strong>{result.placeName}</strong><span>{result.roadAddressName || result.addressName}</span></button>)}{searchMessage && <p>{searchMessage}</p>}<button className="search-manual" type="button" onClick={startManualPin}>찾는 장소가 없나요? 지도에서 직접 선택</button></div>}</div>
        <QuickFilters options={allTags} value={tag} onChange={value => setFilters(current => ({ ...current, status: value === "방문 예정" ? "planned" : "all", tags: value === "전체" || value === "방문 예정" ? [] : [value] }))} />
        {activeFilters.length > 0 && <div className="active-filter-chips" aria-label="적용 중인 필터">{activeFilters.map(filter => <Button key={filter.label} size="sm" variant="outline" aria-label={`${filter.label} 필터 제거`} onClick={filter.remove}>{filter.label}<X /></Button>)}</div>}
        <div className="record-heading"><div><h1>기록</h1><p>{groupVisits.length}개의 방문 기록</p></div></div>
        <div className="record-list">{dataLoading && <p role="status">기록을 불러오는 중…</p>}{(dataError || photoWarning) && <div className="data-warning" role="status"><p>{dataError || photoWarning}</p><Button variant="outline" onClick={() => void refreshVisits(true)}>다시 시도</Button></div>}
        {filtersOpen && <div className="record-filter-panel"><div className="filter-date-row"><Field><FieldLabel htmlFor="filter-from">시작일</FieldLabel><Input id="filter-from" type="date" value={filters.from} onChange={event => setFilters(current => ({ ...current, from: event.target.value }))} /></Field><Field><FieldLabel htmlFor="filter-to">종료일</FieldLabel><Input id="filter-to" type="date" min={filters.from} value={filters.to} onChange={event => setFilters(current => ({ ...current, to: event.target.value }))} /></Field></div><WorkspacePicker label="방문 상태" value={filters.status} options={[{value:"all",label:"방문 상태 전체"},{value:"visited",label:"방문 완료"},{value:"planned",label:"방문 예정"}]} onChange={value => setFilters(current => ({ ...current, status: value as VisitFilters["status"] }))} /><WorkspacePicker label="기록 정렬" value={filters.sort} options={[{value:"newest",label:"최신 방문순"},{value:"oldest",label:"오래된 방문순"},{value:"rating",label:"평점 높은 순"}]} onChange={value => setFilters(current => ({ ...current, sort: value as VisitFilters["sort"] }))} /><fieldset><legend>태그</legend>{Array.from(new Set(visits.filter(visit => visit.groupId===activeGroupId && !visit.deletedAt).flatMap(visit => visit.tags))).map(value => <label key={value}><input type="checkbox" checked={filters.tags.includes(value)} onChange={event => setFilters(current => ({ ...current, tags: event.target.checked ? [...current.tags,value] : current.tags.filter(tag => tag!==value) }))} />{value}</label>)}</fieldset><fieldset><legend>참여자</legend>{members.map(person => <label key={person.id}><input type="checkbox" checked={filters.participants.includes(person.id)} onChange={event => setFilters(current => ({ ...current, participants: event.target.checked ? [...current.participants,person.id] : current.participants.filter(id => id!==person.id) }))} />{person.displayName}</label>)}</fieldset><Button variant="ghost" onClick={() => { setFilters(EMPTY_FILTERS);  }}>필터 초기화</Button></div>}
        {visitDrafts.length>0 && <div className="draft-list">{visitDrafts.map(saved => <div key={saved.key}><span>작성 중인 기록 · {saved.data.fields.title?.[0] || "제목 없음"}</span><Button variant="outline" onClick={() => resumeVisit(saved)}>계속 작성</Button><Button variant="ghost" onClick={() => discardVisitDraft(saved.key)}>초안 삭제</Button></div>)}</div>}

          {!groupVisits.length && <Empty className="empty-records"><EmptyHeader><MapPin aria-hidden="true" /><EmptyTitle>{visits.some(visit=>visit.groupId===activeGroupId && !visit.deletedAt) ? "조건에 맞는 기록이 없어요." : "아직 남긴 발자국이 없어요."}</EmptyTitle><EmptyDescription>{visits.some(visit=>visit.groupId===activeGroupId && !visit.deletedAt) ? "검색어와 필터를 바꾸거나 초기화해 보세요." : "장소를 검색하거나, 지도에서 위치를 직접 고를 수 있어요."}</EmptyDescription></EmptyHeader><EmptyContent><Button variant="outline" onClick={startManualPin}><Plus data-icon="inline-start" />지도에서 첫 장소 추가</Button></EmptyContent></Empty>}
          {dateGroups.map(({ date, visits: dateVisits }) => {
            const active = selectedDateKey === date || searchMode === "records";
            return <section key={date} className={`date-group ${active ? "active" : ""}`}>
              <button className="date-group-toggle" aria-expanded={active} aria-label={`${(date === "rating" ? "평점순" : formatDate(date))} 방문 기록 ${dateVisits.length}개 ${active ? "접기" : "펼치기"}`} onClick={() => { setSelectedDateKey(active ? undefined : date); if (!active && dateVisits[0]) handleVisitSelect(dateVisits[0]); }}><span><CalendarDays size={15} /><time>{date === "rating" ? "평점순" : formatDate(date)}</time>{dateVisits.some((visit) => visit.isPlanned) && <em>방문 예정</em>}</span><strong>{dateVisits.length}곳 <ChevronDown size={15} /></strong></button>
              {active && <div className="date-group-items">{dateVisits.map((visit) => <button key={visit.id} className={`record-item ${visit.isPlanned ? "planned" : ""} ${selectedId === visit.id ? "selected" : ""}`} aria-pressed={selectedId === visit.id} onClick={() => { handleVisitSelect(visit); setMobileList(false); }}><img className="record-marker" src={markerSvgData(visit.markerStyle)} alt="" /><div><strong>{visit.place.name}</strong><p>{visit.title}</p><div className="mini-meta"><span className="rating-summary" aria-label={`별점 ${formatRating(visit.rating)}점`}><SquareSparkIcon className="rating-square-spark" /> {formatRating(visit.rating)}</span><span><Users size={13} /> {visit.participants.length}</span>{visit.photoUrls.length > 0 && <span><Camera size={13} /> {visit.photoUrls.length}</span>}{visit.isPlanned && <span className="planned-label">방문 예정</span>}</div></div></button>)}</div>}
            </section>;
          })}
        </div>
        <footer className="sidebar-footer"><span className="avatar">{getMemberInitials(viewerName ?? members[0]?.displayName ?? "여행자")}</span><div><strong>{viewerName ?? members[0]?.displayName ?? "여행자"}</strong><span>{initialData.demoMode ? "간편 로그인" : "로그인됨"}</span></div><button ref={groupMenuButtonRef} className="icon-button" type="button" aria-label="그룹 메뉴" aria-controls="group-menu" aria-expanded={groupMenu} onClick={() => setGroupMenu((value) => !value)}><Menu size={19} /></button>{groupMenu && <div ref={groupMenuRef} id="group-menu" className="group-menu"><strong>{activeGroup?.name}</strong><span>구성원 {activeGroup?.memberCount}명 · {canManageActiveGroup ? "그룹장" : "멤버"}</span><button className="theme-toggle" type="button" aria-expanded={themePickerOpen} onClick={() => setThemePickerOpen((value) => !value)}><Palette size={15} />테마 선택<ChevronDown size={14} /></button>{themePickerOpen && <div className="theme-picker" role="radiogroup" aria-label="테마 선택">{THEME_OPTIONS.map((option) => <button key={option.id} className={`theme-option ${theme === option.id ? "active" : ""}`} type="button" role="radio" aria-checked={theme === option.id} onClick={() => { setTheme(option.id); setThemePickerOpen(false); }}><span className="theme-swatch" style={{ background: option.swatch }} /><span><strong>{option.label}</strong><small>{option.description}</small></span>{theme === option.id && <Check size={14} aria-hidden="true" />}</button>)}</div>}<FontPicker /><Button variant="ghost" onClick={() => void openTrash()}>휴지통</Button><small className="group-menu-hint">등록된 네 명이 지도와 여행 계획을 함께 보고 수정할 수 있어요.</small><InstallAppButton />{canManageActiveGroup && <button className="group-menu-delete" type="button" onClick={deleteGroup}>현재 지도 삭제</button>}<button className="group-menu-logout" onClick={logout}><LogOut size={15} />로그아웃</button></div>}</footer>
      </aside>

      <section ref={mapStageRef} className="map-stage" inert={isMobile && mobileList} onPointerDown={closeGroupMenu}>
        <KakaoMap key={mapProvider} visits={groupVisits} mapProvider={mapProvider} selectedId={selectedId} selectionRequest={selectionRequest} highlightedIds={highlightedIds} manualMode={manualMode} onSelect={handleVisitSelect} onAnchorChange={handleAnchorChange} onDismissPopup={handlePopupDismiss} onManualPoint={manualPoint} focusLocation={currentLocation} mapFocus={mapFocus} maxZoomRequest={maxZoomRequest} pulseLocation={pulseLocation} />
        <div className="map-topbar"><button className="icon-button mobile-list-button" onClick={() => openMobileList()} aria-label="기록 목록 열기" aria-controls="journal-sidebar" aria-expanded={mobileList}><List size={20} /></button><button className="mobile-search-button" onClick={() => openMobileList("search")}><Search size={18} /><span>장소 검색</span></button><div className="map-date"><CalendarDays size={16} /><span>{mapSummary}</span></div><button className="location-button" onClick={locateMe}><LocateFixed size={17} />내 위치</button></div>
        <ToggleGroup className="map-provider-switch" type="single" value={mapProvider} onValueChange={(value) => { if (value === "kakao" || value === "osm") changeMapProvider(value); }} spacing={1} aria-label="지도 선택"><ToggleGroupItem value="kakao"><MapIcon aria-hidden="true" />국내</ToggleGroupItem><ToggleGroupItem value="osm"><Globe2 aria-hidden="true" />해외</ToggleGroupItem></ToggleGroup>
        <button className={`add-pin-button ${manualMode ? "active" : ""}`} aria-label={manualMode ? "핀 추가 취소" : "지도에 핀 추가"} onClick={() => manualMode ? setManualMode(false) : startManualPin()}><Plus size={19} /><span>{manualMode ? "핀 추가 취소" : "지도에 핀 추가"}</span></button>
        {selected && <article ref={sheetRef} aria-label={`${selected.place.name} 방문 기록`} className={`place-sheet ${activePhotoUrl ? "has-photo" : ""} ${popupPosition ? "is-positioned" : ""} ${sheetExpanded ? "is-expanded" : ""}`} data-placement={popupPosition?.placement} style={sheetStyle}>
          {pendingAction === "delete" && <div className="operation-progress" role="progressbar" aria-label="기록 삭제 중" />}
          <div className="sheet-toolbar">
            <button className="sheet-expand" type="button" aria-expanded={sheetExpanded} aria-controls="visit-detail-body" onClick={() => { setNotice(""); setSheetExpanded((value) => !value); }}><ChevronDown size={18} />{sheetExpanded ? "지도와 함께 보기" : "기록 크게 보기"}</button>
            <button className="sheet-close" disabled={Boolean(pendingAction)} onClick={() => { setPhotoView({ visitId: "", index: 0 }); setSelectedId(undefined); setSelectedAnchor(undefined); }} aria-label="상세 닫기"><X size={18} /></button>
          </div>
          <div className="sheet-body" id="visit-detail-body">
          {activePhotoUrl && <div className="sheet-photo" onTouchStart={(event) => { photoTouchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const start = photoTouchStartX.current; const end = event.changedTouches[0]?.clientX; photoTouchStartX.current = null; if (start === null || end === undefined || Math.abs(start - end) < 42) return; showPhoto(start > end ? 1 : -1); }}>
            <button className="photo-enlarge" type="button" aria-label="사진 크게 보기" onClick={() => { setPhotoError(""); setLightboxOffset({ x: 0, y: 0 }); setLightbox(true); }}><img key={`${selected.id}:${selected.photoIds?.[activePhotoIndex] ?? activePhotoIndex}`} src={activePhotoUrl} alt={`${selected.place.name} 방문 사진 ${activePhotoIndex + 1}/${selected.photoUrls.length}`} draggable={false} /></button>
            {selected.photoUrls.length > 1 && <>
              <button className="sheet-photo-nav previous" type="button" onClick={() => showPhoto(-1)} aria-label="이전 사진"><ChevronLeft size={21} /></button>
              <button className="sheet-photo-nav next" type="button" onClick={() => showPhoto(1)} aria-label="다음 사진"><ChevronRight size={21} /></button>
              <span className="sheet-photo-count" aria-live="polite">{activePhotoIndex + 1} / {selected.photoUrls.length}</span>
            </>}
          </div>}
          <div className="sheet-content"><div className="sheet-date"><Badge variant="secondary">{formatDate(selected.visitedOn)}</Badge><Badge variant="outline">{selected.place.category}</Badge></div><h2>{selected.place.name}</h2><p className="sheet-address"><MapPin size={15} />{selected.place.address || "직접 지정한 위치"}</p><div className="sheet-rating" aria-label={`별점 ${formatRating(selected.rating)}점, 5점 만점`}><SquareSparkIcon className="rating-square-spark" /><strong>{formatRating(selected.rating)}</strong><span>/5.0</span></div><h3>{selected.title}</h3><p className="sheet-note">{selected.note}</p><div className="sheet-tags">{selected.tags.map((item) => <Badge key={item} variant="outline">#{item}</Badge>)}</div><div className="sheet-footer"><div className="participants">{selected.participants.map((person) => <span key={person.id} title={person.displayName}>{person.initials}</span>)}<small>함께</small></div><div className="sheet-actions"><button onClick={() => { setPlannerVisit(selected); setPlannerOpen(true); setMobileList(false); }}>여행 일정에 넣기</button><button className="zoom-button" type="button" disabled={Boolean(pendingAction)} onClick={() => zoomToVisit(selected)} aria-label="선택 위치 최대 확대"><ZoomIn size={14} />최대 확대</button><button disabled={Boolean(pendingAction)} onClick={() => openEdit(selected)}>수정</button><button className="danger-button" disabled={Boolean(pendingAction)} onClick={() => deleteVisit(selected)}>{pendingAction === "delete" ? "삭제 중…" : "삭제"}</button></div></div></div>
          </div>
        </article>}
        {undo && <div className="undo-notice" role="status">기록을 삭제했습니다.<Button variant="outline" onClick={() => void restoreVisit(undo.id,undo.version)}>실행 취소</Button></div>}
        {!online && <div className="network-status" role="status">오프라인 · 입력 내용은 초안으로 보관됩니다.</div>}
        {notice && <button className="notice" onClick={() => setNotice("")} aria-live="polite">{notice}<X size={14} /></button>}
        <nav className="mobile-nav" aria-label="모바일 주요 메뉴">
          <button className={!mobileList && !manualMode ? "active" : ""} aria-current={!mobileList && !manualMode ? "page" : undefined} type="button" onClick={() => { setMobileList(false); setManualMode(false); setSelectedId(undefined); setSelectedAnchor(undefined); }}><MapIcon size={21} />지도</button>
          <button type="button" onClick={() => openMobileList()}><List size={21} />기록</button>
          <button type="button" onClick={() => { setPlannerVisit(undefined); setPlannerOpen(true); setMobileList(false); }}><CalendarDays size={21} />여행 계획</button><button className={manualMode ? "active" : ""} aria-pressed={manualMode} type="button" onClick={() => manualMode ? setManualMode(false) : startManualPin()}>{manualMode ? <X size={23} /> : <Plus size={23} />}{manualMode ? "추가 취소" : "추가"}</button>
          <button type="button" onClick={() => openMobileList("groups")}><Users size={21} />그룹</button>
        </nav>
      </section>

      {confirmation.dialog}
      <dialog ref={lightboxRef} className="photo-lightbox" aria-label="사진 크게 보기"
        style={{ translate: `${lightboxOffset.x}px ${lightboxOffset.y}px`, "--photo-aspect": lightboxAspect } as CSSProperties}
        onClose={() => { lightboxDrag.current = null; setLightbox(false); }}
        onKeyDown={event => { if (event.key === "ArrowLeft") showPhoto(-1); if (event.key === "ArrowRight") showPhoto(1); }}>
        <div className="lightbox-toolbar">
          <button type="button" className="lightbox-drag-handle" aria-label="사진 창 이동" title="드래그하거나 방향키로 이동"
            onPointerDown={event => {
              if (event.button !== 0 || !lightboxRef.current) return;
              lightboxDrag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: lightboxOffset.x, offsetY: lightboxOffset.y, rect: lightboxRef.current.getBoundingClientRect() };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => {
              const drag = lightboxDrag.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              moveLightbox(event.clientX - drag.x, event.clientY - drag.y, drag.rect, drag.offsetX, drag.offsetY);
            }}
            onPointerUp={event => { lightboxDrag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
            onPointerCancel={() => { lightboxDrag.current = null; }}
            onLostPointerCapture={() => { lightboxDrag.current = null; }}
            onKeyDown={event => {
              const steps: Record<string, [number, number]> = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] };
              const step = steps[event.key];
              if (!step || !lightboxRef.current) return;
              event.preventDefault(); event.stopPropagation();
              moveLightbox(step[0], step[1], lightboxRef.current.getBoundingClientRect(), lightboxOffset.x, lightboxOffset.y);
            }}>
            <strong>{selected?.place.name} · {activePhotoIndex + 1}/{selected?.photoUrls.length}</strong>
            <span>드래그하여 이동</span>
          </button>
          <Button variant="ghost" className="lightbox-control" aria-label="가운데로" title="가운데로" onClick={() => { lightboxDrag.current = null; setLightboxOffset({ x: 0, y: 0 }); }}><LocateFixed /></Button>
          <Button variant="ghost" className="lightbox-control" aria-label="사진 삭제" title="사진 삭제" disabled={photoBusy} onClick={() => void deletePhoto()}><Trash2 /></Button>
          <Button variant="ghost" className="lightbox-control" aria-label="사진 보기 닫기" title="닫기" onClick={() => lightboxRef.current?.close()}><X /></Button>
        </div>
        {photoError && <p className="form-error" role="alert">{photoError}</p>}
        <div className="lightbox-image-stage">
          {activePhotoUrl && <img src={activePhotoUrl} alt="확대된 방문 사진" draggable={false} onLoad={event => {
            const image = event.currentTarget;
            if (!image.naturalWidth || !image.naturalHeight) return;
            const aspect = image.naturalWidth / image.naturalHeight;
            if (aspect !== lightboxAspect) { setLightboxAspect(aspect); lightboxDrag.current = null; setLightboxOffset({ x: 0, y: 0 }); }
          }} />}
          {selected && selected.photoUrls.length > 1 && <div className="lightbox-navigation"><Button variant="ghost" className="lightbox-control" aria-label="확대 사진 이전" onClick={() => showPhoto(-1)}><ChevronLeft /></Button><Button variant="ghost" className="lightbox-control" aria-label="확대 사진 다음" onClick={() => showPhoto(1)}><ChevronRight /></Button></div>}
        </div>
      </dialog>
      {trashOpen && <TrashDialog visits={trash} loading={trashLoading} error={trashError} onClose={() => setTrashOpen(false)} onRestore={restoreVisit} />}
      <InstallAppButton autoPrompt suppressAutoPrompt={Boolean(selected || draftPlace || manualMode || mobileList)} />

      <dialog ref={dialogRef} className="visit-dialog" aria-describedby="visit-dialog-title" aria-label={editing ? "기록 고치기" : "새 방문 기록"} onCancel={(event) => { if (pendingAction) event.preventDefault(); }} onClose={() => { writeDraftNow.current?.(); if (draftTimer.current) clearTimeout(draftTimer.current); writeDraftNow.current=null; requestIdRef.current=""; setRestoredFields(null); setDraftKey(""); photoRequestsRef.current=[]; setPhotoRetry(undefined); setVisitConflict(false); setFieldErrors({}); setDraftPlace(null); setEditing(null); setFormError(""); setPulseLocation(undefined); }}>
        <form method="dialog" className="dialog-close-form"><button disabled={Boolean(pendingAction)} aria-label="창 닫기"><X size={20} /></button></form>
        {formError && <p className="visit-form-error" role="alert">{formError}</p>}
        {draftPlace && (
          <form className="visit-form" onSubmit={saveVisit} onChange={event => { setFieldErrors({}); requestIdRef.current=crypto.randomUUID(); persistVisitForm(event.currentTarget); }}>
            {pendingAction === "save" && <div className="operation-progress" role="progressbar" aria-label={editing ? "기록 수정 중" : "기록 저장 중"} />}
            <div className="form-title">
              <MapPin size={22} />
              <div><h2 id="visit-dialog-title">{draftPlace.name || "이 위치에 이름을 붙여주세요"}</h2></div>
            </div>
            <FieldGroup className="form-grid">
              <Field><FieldLabel htmlFor="visit-field-1">장소 이름</FieldLabel><Input aria-invalid={Boolean(fieldErrors["place.name"])} aria-describedby={fieldErrors["place.name"] ? "visit-field-1-error" : undefined} id="visit-field-1" name="placeName" maxLength={120} defaultValue={restoredFields?.placeName?.[0] ?? draftPlace.name} required /><FieldError id="visit-field-1-error">{fieldErrors["place.name"]}</FieldError></Field>
              <Field><FieldLabel htmlFor="visit-field-2">방문한 날</FieldLabel><Input aria-invalid={Boolean(fieldErrors["visitedOn"])} aria-describedby={fieldErrors["visitedOn"] ? "visit-field-2-error" : undefined} id="visit-field-2" name="visitedOn" type="date" defaultValue={restoredFields?.visitedOn?.[0] ?? editing?.visitedOn ?? new Date().toISOString().slice(0, 10)} required /><FieldError id="visit-field-2-error">{fieldErrors["visitedOn"]}</FieldError></Field>
            </FieldGroup>
            <label className="planned-toggle"><input name="isPlanned" type="checkbox" defaultChecked={restoredFields ? Boolean(restoredFields.isPlanned) : editing?.isPlanned ?? false} /><span><strong>방문 예정</strong><small>아직 방문하지 않은 장소로 표시</small></span></label>
            <Field><FieldLabel htmlFor="visit-field-3">주소 또는 위치 설명</FieldLabel><Input aria-invalid={Boolean(fieldErrors["place.address"])} aria-describedby={fieldErrors["place.address"] ? "visit-field-3-error" : undefined} id="visit-field-3" name="address" maxLength={240} defaultValue={restoredFields?.address?.[0] ?? draftPlace.address} placeholder="예: 해방촌 골목 안쪽" /><FieldError id="visit-field-3-error">{fieldErrors["place.address"]}</FieldError></Field>
            <fieldset className="marker-picker">
              <legend>지도에 표시할 핀</legend>
              <div>{MARKER_STYLE_IDS.map((style, index) => <label key={style} className={markerStyle === style ? "selected" : undefined} title={`핀 ${index + 1}`}><input type="radio" name="markerStyle" value={style} checked={markerStyle === style} onChange={() => setMarkerStyle(style)} aria-label={`핀 ${index + 1}`} /><img src={markerSvgDataUrl(style)} alt="" /><Check size={14} strokeWidth={3} aria-hidden="true" /></label>)}</div>
              {!MARKER_STYLE_IDS.includes(markerStyle) && <small className="marker-picker-hint">기존 사각 핀을 유지합니다. 원형 핀을 선택하면 변경돼요.</small>}
            </fieldset>
            <Field><FieldLabel htmlFor="visit-field-4">기록 제목</FieldLabel><Input aria-invalid={Boolean(fieldErrors["title"])} aria-describedby={fieldErrors["title"] ? "visit-field-4-error" : undefined} id="visit-field-4" name="title" maxLength={120} defaultValue={restoredFields?.title?.[0] ?? editing?.title} placeholder="그날을 한 문장으로" required /><FieldError id="visit-field-4-error">{fieldErrors["title"]}</FieldError></Field>
            <Field><FieldLabel htmlFor="visit-field-5">무엇을 했나요?</FieldLabel><Textarea aria-invalid={Boolean(fieldErrors["note"])} aria-describedby={fieldErrors["note"] ? "visit-field-5-error" : undefined} id="visit-field-5" name="note" maxLength={3000} defaultValue={restoredFields?.note?.[0] ?? editing?.note} rows={4} placeholder="먹은 것, 나눈 이야기, 다시 오고 싶은 이유…" /><FieldError id="visit-field-5-error">{fieldErrors["note"]}</FieldError></Field>
            <FieldGroup className="form-grid">
              <RatingPicker defaultValue={Number(restoredFields?.rating?.[0] ?? editing?.rating ?? 5)} />
              <Field><FieldLabel htmlFor="visit-field-6">태그</FieldLabel><Input aria-invalid={Boolean(fieldErrors["tags"])} aria-describedby={fieldErrors["tags"] ? "visit-field-6-error" : undefined} id="visit-field-6" name="tags" defaultValue={restoredFields?.tags?.[0] ?? editing?.tags.join(", ")} placeholder="데이트, 산책, 맛집" /><FieldError id="visit-field-6-error">{fieldErrors["tags"]}</FieldError></Field>
            </FieldGroup>
            <fieldset>
              <legend>함께한 사람</legend>
              <div className="member-checks">{members.map((member) => <label key={member.id}><input type="checkbox" name={`member-${member.id}`} defaultChecked={restoredFields ? Boolean(restoredFields["member-"+member.id]) : editing ? editing.participants.some((person) => person.id === member.id) : true} /><span className="member-avatar">{member.initials}</span><span className="member-name">{member.displayName}</span><Check className="member-checkmark" size={13} strokeWidth={3} aria-hidden="true" /></label>)}</div>
            </fieldset>
            <label className="photo-input"><Camera size={20} /><span><strong>사진 추가</strong><small>최대 5장 · 사진당 약 350KB로 자동 압축</small></span><input name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple /></label>
            {visitConflict && <div className="conflict-panel"><strong>다른 멤버가 먼저 수정했습니다.</strong><p>최신 내용: {visits.find(visit => visit.id === editing?.id)?.title} · {visits.find(visit => visit.id === editing?.id)?.note}</p><Button variant="outline" onClick={() => { const latest=visits.find(visit => visit.id === editing?.id); if (latest) { setEditing(current => current ? { ...current, version: latest.version } : current); requestIdRef.current=crypto.randomUUID(); setVisitConflict(false); setFormError("내 입력을 유지했습니다. 확인 후 저장해 주세요."); } }}>최신 버전 확인 후 내 입력 유지</Button></div>}
            {photoRetry && <Button variant="outline" disabled={Boolean(pendingAction)} onClick={() => void retryPhotos()}>실패한 사진 {photoRetry.files.length}장 다시 올리기</Button>}
            <div className="form-actions"><button type="button" disabled={Boolean(pendingAction)} onClick={() => dialogRef.current?.close()}>취소</button><button className="primary-button" disabled={Boolean(pendingAction) || Boolean(photoRetry) || visitConflict} type="submit">{pendingAction === "save" ? (editing ? "수정 중…" : "저장 중…") : editing ? "수정 내용 저장" : "지도에 기록 남기기"}</button></div>
          </form>
        )}
      </dialog>
      <dialog ref={groupDialogRef} className="group-dialog" aria-labelledby="group-dialog-title" onClose={() => setNewGroupName("")}>
        <form className="group-create-form" onSubmit={createGroup}>
          <div className="form-title"><MapIcon size={21} /><div><h2 id="group-dialog-title">새 지도 만들기</h2></div></div>
          <label htmlFor="new-group-name">지도 이름<input id="new-group-name" value={newGroupName} disabled={groupBusy} onChange={(event) => { setNewGroupName(event.target.value); groupRequestId.current = crypto.randomUUID(); }} placeholder="예: 제주도 여름 기록" maxLength={40} autoFocus required /></label>
          <p className="form-message">새 지도는 네 명이 함께 기록할 수 있어요.</p>
          {groupError && <p className="form-error" role="alert">{groupError}</p>}<div className="form-actions"><Button variant="outline" disabled={groupBusy} onClick={() => groupDialogRef.current?.close()}>취소</Button><Button disabled={groupBusy} type="submit">{groupBusy ? "만드는 중…" : "지도 만들기"}</Button></div>
        </form>
      </dialog>
    </main>
  );
}
