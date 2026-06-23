import React, { useEffect, useState } from "react";

const INSTALL_PROMPT_KEY = "clooval_install_prompt_dismissed";
const INSTALL_PROMPT_DELAY_MS = 2500;

declare global {
  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
    prompt(): Promise<void>;
  }
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|windows phone|mobile/i.test(navigator.userAgent);
}

function isIosSafari() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|opera/i.test(ua);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isPromptDismissed, setIsPromptDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mobile = isMobileDevice();
    setIsMobile(mobile);
    setIsIos(isIosSafari());
    setIsInstalled(isStandaloneMode());
    setIsPromptDismissed(window.localStorage.getItem(INSTALL_PROMPT_KEY) === "true");

    const handleBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      event.preventDefault();
      setDeferredPrompt(installEvent);
      if (mobile && !isStandaloneMode() && window.localStorage.getItem(INSTALL_PROMPT_KEY) !== "true") {
        window.setTimeout(() => setShowPrompt(true), INSTALL_PROMPT_DELAY_MS);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (isInstalled || isPromptDismissed || !isMobile) {
      return;
    }

    if (!deferredPrompt && isIos) {
      const timer = window.setTimeout(() => setShowPrompt(true), INSTALL_PROMPT_DELAY_MS);
      return () => window.clearTimeout(timer);
    }
  }, [deferredPrompt, isInstalled, isPromptDismissed, isMobile, isIos]);

  if (!isMobile || isInstalled || isPromptDismissed || !showPrompt) {
    return null;
  }

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setShowPrompt(false);
      window.localStorage.setItem(INSTALL_PROMPT_KEY, "true");
      setIsPromptDismissed(true);
      return;
    }

    try {
      setInstalling(true);
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      setInstalling(false);
      window.localStorage.setItem(INSTALL_PROMPT_KEY, "true");
      setShowPrompt(false);
      setIsPromptDismissed(true);
      if (choiceResult.outcome === "accepted") {
        setIsInstalled(true);
      }
    } catch (error) {
      setInstalling(false);
      setShowPrompt(false);
      window.localStorage.setItem(INSTALL_PROMPT_KEY, "true");
      setIsPromptDismissed(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    window.localStorage.setItem(INSTALL_PROMPT_KEY, "true");
    setIsPromptDismissed(true);
  };

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 md:hidden">
      <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-[#E5E5E3] shadow-[0_20px_70px_rgba(0,0,0,0.12)] px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F2A900]/10 text-[#F2A900]">
            <span className="text-lg font-semibold">⌘</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#111111]">Add Clooval to your home screen</p>
            <p className="mt-1 text-xs leading-5 text-[#555555]">
              Get the fastest mobile experience for request updates, one-tap access, and offline entry.
            </p>
            <div className="mt-3 space-y-2 text-xs text-[#555555]">
              {deferredPrompt ? (
                <p>Tap install to add the app to your device.</p>
              ) : (
                <p>
                  For iPhone: tap the share icon, then choose <strong>Add to Home Screen</strong>.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleInstall}
            className="inline-flex flex-1 items-center justify-center rounded-2xl bg-[#111111] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={installing}
          >
            {installing ? "Installing..." : deferredPrompt ? "Install App" : "How to install"}
          </button>
          <button
            onClick={handleDismiss}
            className="inline-flex items-center justify-center rounded-2xl border border-[#E5E5E3] bg-white px-4 py-3 text-sm font-semibold text-[#555555] transition hover:bg-[#F7F7F5]"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
