"use client";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "./ui/button";

export function useDesktopSidebar(userId: string) {
  const key = `${userId}:desktop-sidebar-collapsed`;
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { const timer = setTimeout(() => { try { setCollapsed(localStorage.getItem(key) === "true"); } catch { /* Storage is optional. */ } }, 0); return () => clearTimeout(timer); }, [key]);
  return { collapsed, setCollapsed(value: boolean) { setCollapsed(value); try { localStorage.setItem(key, String(value)); } catch { /* Storage is optional. */ } } };
}

export function DesktopSidebarToggle({ collapsed, controls, onChange }: { collapsed: boolean; controls: string; onChange: (collapsed: boolean) => void }) {
  const label = collapsed ? "왼쪽 메뉴 펼치기" : "왼쪽 메뉴 숨기기";
  return <Button variant="outline" size="icon" className="desktop-sidebar-toggle" data-sidebar-toggle={collapsed ? "open" : "close"} aria-label={label} title={label} aria-controls={controls} aria-expanded={!collapsed} onClick={event => {
    const root = event.currentTarget.closest(".journal-app");
    onChange(!collapsed);
    requestAnimationFrame(() => root?.querySelector<HTMLButtonElement>(`[data-sidebar-toggle="${collapsed ? "close" : "open"}"]`)?.focus());
  }}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>;
}
