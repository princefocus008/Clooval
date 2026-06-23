declare global {
  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
    prompt(): Promise<void>;
  }

  interface Window {
    cloovalDeferredInstallPrompt?: BeforeInstallPromptEvent;
  }
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function storeInstallPrompt(event: BeforeInstallPromptEvent) {
  deferredPrompt = event;
  if (typeof window !== "undefined") {
    window.cloovalDeferredInstallPrompt = event;
  }
}

export async function promptInstallApp() {
  if (!deferredPrompt && typeof window !== "undefined") {
    deferredPrompt = window.cloovalDeferredInstallPrompt ?? null;
  }

  if (!deferredPrompt) {
    return null;
  }

  await deferredPrompt.prompt();
  const result = await deferredPrompt.userChoice;
  return result;
}
