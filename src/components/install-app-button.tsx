"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALL_DISMISSED_KEY = "place-memory-install-prompt-dismissed-v1";
const INSTALL_READY_EVENT = "place-memory-install-ready";
let sharedInstallPrompt: InstallPromptEvent | null = null;

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

const isIosDevice = () => typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export function InstallAppButton({ autoPrompt = false, suppressAutoPrompt = false }: { autoPrompt?: boolean; suppressAutoPrompt?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(() => sharedInstallPrompt);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos] = useState(isIosDevice);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 820px)").matches;
    const ios = isIosDevice();
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as NavigatorWithStandalone).standalone);
    const dismissed = window.localStorage.getItem(INSTALL_DISMISSED_KEY) === "true";

    const promptHandler = (event: Event) => {
      event.preventDefault();
      sharedInstallPrompt = event as InstallPromptEvent;
      setDeferredPrompt(sharedInstallPrompt);
      window.dispatchEvent(new Event(INSTALL_READY_EVENT));
      if (autoPrompt && !suppressAutoPrompt && mobile && !standalone && !dismissed) setShowPrompt(true);
    };
    const syncPrompt = () => setDeferredPrompt(sharedInstallPrompt);
    const installedHandler = () => {
      sharedInstallPrompt = null;
      setDeferredPrompt(null);
      setShowPrompt(false);
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
      window.dispatchEvent(new Event(INSTALL_READY_EVENT));
    };

    window.addEventListener("beforeinstallprompt", promptHandler);
    window.addEventListener(INSTALL_READY_EVENT, syncPrompt);
    window.addEventListener("appinstalled", installedHandler);
    const timer = window.setTimeout(() => {
      if (autoPrompt && !suppressAutoPrompt && mobile && ios && !standalone && !dismissed) setShowPrompt(true);
    }, 900);
    return () => {
      window.removeEventListener("beforeinstallprompt", promptHandler);
      window.removeEventListener(INSTALL_READY_EVENT, syncPrompt);
      window.removeEventListener("appinstalled", installedHandler);
      window.clearTimeout(timer);
    };
  }, [autoPrompt, suppressAutoPrompt]);

  useEffect(() => {
    if (!suppressAutoPrompt) return;
    const frame = window.requestAnimationFrame(() => setShowPrompt(false));
    return () => window.cancelAnimationFrame(frame);
  }, [suppressAutoPrompt]);

  function dismissPrompt() {
    setShowPrompt(false);
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    sharedInstallPrompt = null;
    setDeferredPrompt(null);
    setShowPrompt(false);
    if (choice.outcome === "dismissed") window.localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
    window.dispatchEvent(new Event(INSTALL_READY_EVENT));
  }

  if (autoPrompt) {
    if (suppressAutoPrompt || !showPrompt || (!deferredPrompt && !isIos)) return null;
    return (
      <section className="install-prompt" role="dialog" aria-modal="false" aria-labelledby="install-prompt-title">
        <button className="install-prompt-close" type="button" onClick={dismissPrompt} aria-label="앱 설치 안내 닫기"><X size={19} /></button>
        <div className="install-prompt-icon" aria-hidden="true"><img src="/map-pins/color-16.png" alt="" /></div>
        <div className="install-prompt-copy">
          <h2 id="install-prompt-title">앱으로 설치할까요?</h2>
          <p>앱처럼 바로 열고, 함께 남긴 장소를 더 빠르게 확인할 수 있어요.</p>
          {showIosHelp && <p className="install-prompt-ios"><Share size={16} />브라우저의 공유 버튼을 누른 뒤 <strong>‘홈 화면에 추가’</strong>를 선택하세요.</p>}
        </div>
        <div className="install-prompt-actions">
          <button type="button" className="install-prompt-later" onClick={dismissPrompt}>나중에</button>
          {isIos
            ? <button type="button" className="install-prompt-primary" onClick={() => setShowIosHelp(true)}><Share size={17} />설치 방법 보기</button>
            : <button type="button" className="install-prompt-primary" onClick={install}><Download size={17} />지금 설치</button>}
        </div>
      </section>
    );
  }

  if (deferredPrompt) return <button className="group-menu-install" onClick={install}><Download size={15} />앱 설치</button>;
  if (isIos) return <><button className="group-menu-install" onClick={() => setShowIosHelp((value) => !value)}><Share size={15} />홈 화면에 추가</button>{showIosHelp && <p className="ios-install-help">Safari의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요.</p>}</>;
  return null;
}
