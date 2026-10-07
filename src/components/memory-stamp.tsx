"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { MapAnchor } from "./kakao-map";

export function MemoryStamp({ anchor }: { anchor?: MapAnchor }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setVisible(false), 2600); return () => clearTimeout(timer); }, []);
  if (!visible || !anchor) return null;
  return <div className="memory-stamp" aria-hidden="true" style={{ left: anchor.x, top: anchor.topY ?? anchor.y }}><Check size={24} strokeWidth={3} /></div>;
}
