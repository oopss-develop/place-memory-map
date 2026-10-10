import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "우뚜막",
    short_name: "우뚜막",
    description: "함께 남기는 비공개 장소 기록 지도",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f0df",
    theme_color: "#f6f0df",
    lang: "ko",
    orientation: "portrait-primary",
    icons: [
      { src: "/app-icon-192.png?v=4", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon-512.png?v=4", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon-maskable-512.png?v=4", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
