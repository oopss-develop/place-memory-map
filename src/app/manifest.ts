import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Place Memory Map",
    short_name: "Place Map",
    description: "함께 남기는 비공개 장소 기록 지도",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4efdf",
    theme_color: "#f4efdf",
    lang: "ko",
    orientation: "portrait-primary",
    icons: [
      { src: "/pwa-icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon?size=512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
