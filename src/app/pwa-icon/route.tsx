import { ImageResponse } from "next/og";

export function GET(request: Request) {
  const size = new URL(request.url).searchParams.get("size") === "192" ? 192 : 512;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#f4efdf" }}>
        <div style={{ display: "flex", width: "72%", height: "72%", alignItems: "center", justifyContent: "center", borderRadius: "44% 44% 44% 12%", background: "#d84c32", transform: "rotate(-8deg)" }}>
          <div style={{ width: "31%", height: "31%", borderRadius: "50%", background: "#fffdf6", transform: "rotate(8deg)" }} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
