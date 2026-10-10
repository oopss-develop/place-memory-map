import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "wordmark" : "brand-mark"}>
      <span className="wordmark-pin"><Image src="/brand-icon-v4.png" alt="" width={52} height={52} /></span>
      <span className="brand-copy"><span className="brand-name">우뚜막</span><span className="brand-caption">우리 둘의 작은 오두막</span></span>
    </div>
  );
}
