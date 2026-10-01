import { MapPin } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "wordmark" : "brand-mark"}>
      <span className="wordmark-pin"><MapPin size={19} aria-hidden="true" /></span>
      <span>Place Memory Map</span>
    </div>
  );
}
