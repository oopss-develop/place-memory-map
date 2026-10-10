import { stickerSeries } from "@/lib/stickers";
export function GET() { return Response.json({ series: stickerSeries }, { headers: { "Cache-Control": "no-store" } }); }
