import { readFile } from "node:fs/promises";

export function GET(request: Request) {
  const size = new URL(request.url).searchParams.get("size") === "192" ? 192 : 512;
  return readFile(`${process.cwd()}/public/app-icon-${size}.png`).then((file) => new Response(file, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" } }));
}
