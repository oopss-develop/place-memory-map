import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

export function Progress({ label = "불러오는 중", className, style }: { label?: string; className?: string; style?: CSSProperties }) {
  return <div data-slot="progress" role="progressbar" aria-label={label} style={style} className={cn("activity-progress", className)}><div className="activity-progress-indicator" /></div>;
}
