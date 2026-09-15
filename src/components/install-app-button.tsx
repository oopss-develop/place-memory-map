"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const promptHandler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", promptHandler);
    const timer = window.setTimeout(() => setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent)), 0);
    return () => {
      window.removeEventListener("beforeinstallprompt", promptHandler);
      window.clearTimeout(timer);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  if (deferredPrompt) return <button className="group-menu-install" onClick={install}><Download size={15} />앱 설치</button>;
  if (isIos) return <><button className="group-menu-install" onClick={() => setShowIosHelp((value) => !value)}><Share size={15} />홈 화면에 추가</button>{showIosHelp && <p className="ios-install-help">Safari의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요.</p>}</>;
  return null;
}
