const PREFIX = "place-memory-draft-v1:";
const WEEK = 7 * 86400000;
export interface SavedDraft<T = unknown> { key: string; updatedAt: number; data: T }
export function saveDraft<T>(key: string, data: T) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify({ key, updatedAt: Date.now(), data })); } catch { /* Quota/privacy mode: never interrupt editing. */ }
}
export function listDrafts<T>(prefix: string): SavedDraft<T>[] {
  const drafts: SavedDraft<T>[] = [];
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(PREFIX)) continue;
      try {
        const draft = JSON.parse(localStorage.getItem(key) ?? "null") as SavedDraft<T>;
        if (!draft || !draft.updatedAt || Date.now() - draft.updatedAt > WEEK) { localStorage.removeItem(key); continue; }
        if (draft.key.startsWith(prefix)) drafts.push(draft);
      } catch { localStorage.removeItem(key); }
    }
  } catch { return []; }
  return drafts.sort((a,b) => b.updatedAt-a.updatedAt);
}
export function clearDraft(key: string) { try { localStorage.removeItem(PREFIX + key); } catch {} }
export function clearUserDrafts(user: string) { for (const draft of listDrafts(user + ":")) clearDraft(draft.key); }
export function formValues(form: HTMLFormElement) {
  const values: Record<string, string[]> = {};
  for (const [key, value] of new FormData(form)) if (typeof value === "string") (values[key] ??= []).push(value);
  return values;
}
