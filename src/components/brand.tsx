import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "wordmark" : "brand-mark"}>
      <span className="wordmark-pin"><Image src="/brand-icon.png?v=3" alt="" width={32} height={32} /></span>
      <span>우뚜막</span>
    </div>
  );
}
