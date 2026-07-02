import React, { useEffect, useMemo, useState } from "react";
import { Apple, Share2, Smartphone, X } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

const DISMISS_KEY = "clooval_install_dismissed";

export default function PWAInstallBanner() {
  const { deferredPrompt, isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installPending, setInstallPending] = useState(false);

  const isMobile = typeof window !== "undefined" ? window.innerWidth < 768 : false;
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isInStandaloneMode = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);

  const showIOSBanner = isIOS && isSafari && !isInStandaloneMode;
  const showAndroidBanner = isInstallable && !isInStandaloneMode;

  const canRender = isMobile && !dismissed && !isInstalled && (showIOSBanner || showAndroidBanner);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(DISMISS_KEY) === "true") {
      setDismissed(true);
      return;
    }

    if (!canRender) {
      setShowBanner(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowBanner(true);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [canRender]);

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
    setShowBanner(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      handleDismiss();
      return;
    }

    setInstallPending(true);
    const accepted = await promptInstall();
    setInstallPending(false);

    if (!accepted) {
      sessionStorage.setItem(DISMISS_KEY, "true");
      setDismissed(true);
      setShowBanner(false);
    }
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] bg-white border-t border-[#E5E5E3] px-4 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-[760px] items-center gap-3 text-sm text-[#111111] md:px-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#111111] text-white">
          <span className="text-lg font-semibold">C</span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-[#111111]">
            {showIOSBanner ? "Install Clooval" : "Clooval"}
          </p>
          <p className="mt-1 text-[12px] text-[#555555]">
            {showIOSBanner ? (
              <>
                Tap the <Share2 className="inline-block h-3.5 w-3.5 align-text-bottom" /> icon then &lsquo;Add to Home Screen&rsquo;
              </>
            ) : (
              "Add to your home screen"
            )}
          </p>
        </div>

        {!showIOSBanner && (
          <button
            type="button"
            onClick={handleInstall}
            disabled={installPending}
            className="inline-flex h-8 items-center rounded-[6px] border border-[#111111] bg-white px-4 text-[13px] font-medium text-[#111111] transition hover:bg-[#F7F7F7] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Install
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#999999] transition hover:bg-[#F5F5F5]"
          aria-label="Dismiss install banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
