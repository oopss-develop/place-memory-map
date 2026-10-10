import type { Metadata, Viewport } from "next";
import { Gowun_Batang, Noto_Sans_KR } from "next/font/google";
import { PwaRegistration } from "@/components/pwa-registration";
import { FontPreference } from "@/components/font-preference";
import { ActivityProgressProvider } from "@/components/activity-progress";
import "./globals.css";

const sans = Noto_Sans_KR({
  variable: "--font-noto",
  subsets: ["latin"],
  display: "swap",
});

const serif = Gowun_Batang({
  variable: "--font-gowun",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "우뚜막 — 함께 남기는 장소 기록",
  description: "커플과 작은 그룹을 위한 비공개 여행 기록 지도",
  applicationName: "우뚜막",
  appleWebApp: { capable: true, title: "우뚜막", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${sans.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><FontPreference><ActivityProgressProvider><PwaRegistration />{children}</ActivityProgressProvider></FontPreference></body>
    </html>
  );
}
