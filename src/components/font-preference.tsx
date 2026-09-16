"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Check, ChevronDown, Type } from "lucide-react";
import { DEFAULT_FONT, FONT_OPTIONS, FONT_STORAGE_KEY, normalizeFont, type FontId } from "@/lib/fonts";

const FontContext = createContext<{ font: FontId; chooseFont: (font: FontId) => void }>({ font: DEFAULT_FONT, chooseFont: () => {} });

export function FontPreference({ children }: { children: ReactNode }) {
  const [font, setFont] = useState<FontId>(DEFAULT_FONT);

  useEffect(() => {
    const apply = (value: unknown) => {
      const next = normalizeFont(value);
      setFont(next);
      document.documentElement.dataset.font = next;
    };
    try { apply(localStorage.getItem(FONT_STORAGE_KEY)); } catch { apply(DEFAULT_FONT); }
    const sync = (event: StorageEvent) => {
      if (event.key === FONT_STORAGE_KEY || event.key === null) apply(event.newValue);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function chooseFont(next: FontId) {
    setFont(next);
    document.documentElement.dataset.font = next;
    try { localStorage.setItem(FONT_STORAGE_KEY, next); } catch { /* Session choice still works when storage is unavailable. */ }
  }

  return <FontContext.Provider value={{ font, chooseFont }}>{children}</FontContext.Provider>;
}

export function FontPicker() {
  const { font, chooseFont } = useContext(FontContext);
  const [open, setOpen] = useState(false);
  const selected = FONT_OPTIONS.find((option) => option.id === font)!;
  return <>
    <button className="theme-toggle font-toggle" type="button" aria-expanded={open} aria-controls="font-picker-options" onClick={() => setOpen(!open)}>
      <Type size={15} aria-hidden="true" />글꼴 선택<span>{selected.label}</span><ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && <fieldset id="font-picker-options" className="font-picker">
      <legend className="sr-only">글꼴 선택</legend>
      {FONT_OPTIONS.map((option) => <label key={option.id} className={`font-option ${font === option.id ? "active" : ""}`} style={{ fontFamily: option.family }}>
        <input type="radio" name="app-font" value={option.id} checked={font === option.id} onChange={() => chooseFont(option.id)} />
        <span><strong>{option.label}</strong><small>{option.description}</small><span className="font-preview">오늘의 기억 123</span></span>
        {font === option.id && <Check size={16} aria-hidden="true" />}
      </label>)}
      <p>이 기기에 저장되며 모든 테마에 적용돼요.</p>
    </fieldset>}
  </>;
}
