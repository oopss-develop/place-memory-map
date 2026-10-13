"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiRequest, jsonRequest } from "./api-request";
import { boardContentSchema, emptyBoard, type BoardContent, type MemoryBoard } from "./memory-board";

export function useMemoryBoard(groupId: string, viewerId: string, demo: boolean) {
  const [board, setBoard] = useState<MemoryBoard>(emptyBoard);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [history, setHistory] = useState<{ past: BoardContent[]; future: BoardContent[] }>({ past: [], future: [] });
  const current = useRef(board);
  const busy = useRef({ dirty: false, saving: false });
  const alive = useRef(true);
  const request = useRef<{ id: string; content: string } | null>(null);
  const draftKey = `uttumak-board-draft-v1:${viewerId}:${groupId}`;
  const demoKey = `uttumak-board-v1:${groupId}`;
  const editRevision = useRef(0);
  const apply = useCallback((value: MemoryBoard, changed: boolean) => {
    current.current = value; busy.current.dirty = changed; setBoard(value); setDirty(changed);
  }, []);
  useEffect(() => {
    alive.current = true;
    const abort = new AbortController();
    let restored: { board: MemoryBoard; at: number } | null = null;
    try {
      const raw = localStorage.getItem(draftKey); const candidate = raw ? JSON.parse(raw) : null;
      if (candidate && Date.now()-candidate.at < 7*86400000 && boardContentSchema.safeParse(candidate.board).success && Number.isInteger(candidate.board.version)) {
        restored=candidate;
      }
    } catch { /* A corrupt local draft must not prevent loading the shared board. */ }
    const read = async () => {
      await Promise.resolve();
      if (abort.signal.aborted) return;
      if (restored) { apply(restored.board,true); setMessage("이 기기에 남아 있던 배치를 복원했어요."); }
      try {
        let saved = emptyBoard();
        if (demo) {
          const raw = localStorage.getItem(demoKey);
          if (raw) { const value = JSON.parse(raw); const content = boardContentSchema.parse(value); saved = { ...content, version: Number.isInteger(value.version) ? value.version : 0 }; }
        } else saved = (await apiRequest<{ board: MemoryBoard }>(`/api/memory-board?groupId=${groupId}`, { signal: abort.signal })).board;
        if (abort.signal.aborted) return;
        const rawDraft = restored ? JSON.stringify(restored) : localStorage.getItem(draftKey);
        let draft: { board: MemoryBoard; at: number } | null = null;
        try { draft = rawDraft ? JSON.parse(rawDraft) : null; } catch { localStorage.removeItem(draftKey); }
        if (draft && Date.now() - draft.at < 7 * 86400000 && boardContentSchema.safeParse(draft.board).success && Number.isInteger(draft.board.version)) {
          apply(draft.board, true); setMessage("이 기기에 남아 있던 배치를 복원했어요.");
          if (draft.board.version !== saved.version) { setConflict(true); setError("다른 멤버의 새 배치가 있어요. 내 배치를 유지했으니 최신 보드를 확인해 주세요."); }
        } else { apply(saved, false); localStorage.removeItem(draftKey); }
      } catch (issue) { if (!abort.signal.aborted) setError((issue as Error).message); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    };
    void read();
    const sync = async () => {
      if (demo || busy.current.dirty || busy.current.saving || !navigator.onLine || document.visibilityState === "hidden") return;
      const revision = editRevision.current;
      try {
        const { board: saved } = await apiRequest<{ board: MemoryBoard }>(`/api/memory-board?groupId=${groupId}`, { signal: abort.signal });
        if (!abort.signal.aborted && !busy.current.dirty && !busy.current.saving && revision === editRevision.current) { apply(saved, false); setError(""); }
      } catch (issue) { if (!abort.signal.aborted) setError((issue as Error).message); }
    };
    const timer = window.setInterval(sync, 10000);
    window.addEventListener("focus", sync); window.addEventListener("online", sync);
    return () => { alive.current = false; abort.abort(); clearInterval(timer); window.removeEventListener("focus", sync); window.removeEventListener("online", sync); };
  }, [apply, demo, demoKey, draftKey, groupId]);
  const retain = useCallback((value: MemoryBoard) => {
    try { localStorage.setItem(draftKey, JSON.stringify({ board: value, at: Date.now() })); }
    catch { setError("이 기기에 임시 배치를 저장하지 못했어요. 보드 저장을 눌러 주세요."); }
  }, [draftKey]);
  function change(content: BoardContent, record = true) {
    if (loading || saving) return;
    const previous = { background: current.current.background, items: current.current.items };
    if (record) setHistory(h => ({ past: [...h.past.slice(-39), previous], future: [] }));
    const next = { ...content, version: current.current.version };
    editRevision.current++; apply(next, true); retain(next); setMessage("");
  }
  function undo(redo = false) {
    const source = redo ? history.future : history.past;
    const content = source.at(-1); if (!content || saving || loading) return;
    const old = { background: current.current.background, items: current.current.items };
    setHistory(redo ? { past: [...history.past, old], future: history.future.slice(0,-1) } : { past: history.past.slice(0,-1), future: [...history.future, old] });
    change(content, false);
  }
  async function save() {
    if (busy.current.saving || !busy.current.dirty || loading) return;
    const value = current.current;
    const parsed = boardContentSchema.safeParse(value);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    busy.current.saving = true; setSaving(true); setError("");
    const content = JSON.stringify(value);
    if (!request.current || request.current.content !== content) request.current = { id: crypto.randomUUID(), content };
    try {
      let saved: MemoryBoard;
      if (demo) { saved = { ...value, version: value.version + 1 }; localStorage.setItem(demoKey, JSON.stringify(saved)); }
      else saved = (await apiRequest<{ board: MemoryBoard }>("/api/memory-board", jsonRequest("PUT", { ...value, groupId, requestId: request.current.id }))).board;
      if (!alive.current) return;
      apply(saved, false); localStorage.removeItem(draftKey); request.current = null; setConflict(false);
      setMessage(demo ? "이 기기에 보드를 저장했어요." : "함께 보는 보드에 저장했어요.");
    } catch (issue) { if (alive.current) { setError((issue as Error).message); setConflict(issue instanceof ApiError && issue.status === 409); } }
    finally { busy.current.saving = false; if (alive.current) setSaving(false); }
  }
  async function reload() {
    if (busy.current.saving) return;
    setLoading(true);
    try {
      const saved = demo ? JSON.parse(localStorage.getItem(demoKey) ?? JSON.stringify(emptyBoard())) :
        (await apiRequest<{ board: MemoryBoard }>(`/api/memory-board?groupId=${groupId}`)).board;
      if (!alive.current) return;
      // Keep the local arrangement in undo history before explicitly choosing the shared version.
      setHistory({ past: [{ background: current.current.background, items: current.current.items }], future: [] });
      editRevision.current++; apply(saved, false); localStorage.removeItem(draftKey); setError(""); setConflict(false); request.current = null;
      setMessage("저장된 보드를 불러왔어요. 이전 배치는 되돌리기로 복구할 수 있어요.");
    } catch (issue) { if (alive.current) setError((issue as Error).message); }
    finally { if (alive.current) setLoading(false); }
  }
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (busy.current.dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return { board, loading, saving, dirty, error, message, conflict, change, save, reload, undo, canUndo: history.past.length>0, canRedo: history.future.length>0 };
}
