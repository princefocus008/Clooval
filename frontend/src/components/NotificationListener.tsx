import React, { useEffect, useRef } from "react";
import { useNotifications } from "../hooks/queries";
import { useToastStore, useAppStore, useAuthStore } from "../lib/store";

// Helper keys for sessionStorage tracking to thrive across page refreshes
const STORAGE_KEY = "cl_alerted_notifications_v1";

const getAlertedIds = (): Set<string> => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch (e) {}
  return new Set();
};

const saveAlertedIds = (ids: Set<string>) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch (e) {}
};

// Singleton context instance to bypass chrome/safari audio restrictions
let sharedAudioCtx: AudioContext | null = null;

const warmUpAudio = () => {
  try {
    if (!sharedAudioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume();
    }
  } catch (err) {
    console.debug("Quiet audio pre-warming skipped: ", err);
  }
};

export default function NotificationListener() {
  const { data: notifications } = useNotifications();
  const { addToast } = useToastStore();
  const { isAuthenticated, user } = useAuthStore();
  const { setUnreadCount } = useAppStore();
  
  // Track notifications seen during this specific render loop
  const seenIdsRef = useRef<Set<string>>(getAlertedIds());

  // Warm up Web Audio API context during early user touches/clicks anywhere in the viewport
  useEffect(() => {
    const events = ["click", "touchstart", "keydown", "mousedown"];
    const handleAction = () => {
      warmUpAudio();
      // Remove once active
      events.forEach((ev) => document.removeEventListener(ev, handleAction));
    };

    events.forEach((ev) => document.addEventListener(ev, handleAction, { passive: true }));
    return () => {
      events.forEach((ev) => document.removeEventListener(ev, handleAction));
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user || !notifications) {
      if (!isAuthenticated && !localStorage.getItem("cl_token")) {
        // Clear session storage references only when the user is truly logged out.
        seenIdsRef.current.clear();
        sessionStorage.removeItem(STORAGE_KEY);
      }
      setUnreadCount(0);
      return;
    }

    setUnreadCount(notifications.filter((notif) => !notif.isRead).length);
    const currentAlerted = getAlertedIds();
    let newlyDiscovered = false;

    notifications.forEach((notif) => {
      // If notification is unread and HAS NOT been alerted in this browser session
      if (!notif.isRead && !currentAlerted.has(notif.id)) {
        currentAlerted.add(notif.id);
        seenIdsRef.current.add(notif.id);
        newlyDiscovered = true;

        const targetUrl = notif.requestId
          ? user.role === "admin"
            ? `/admin/requests/${notif.requestId}`
            : `/app/requests/${notif.requestId}`
          : "/notifications";

        // Custom display duration: 8000ms (at least 5 seconds, up to 8 seconds!)
        // It provides a distinct informational toast notification
        addToast(`🔔 ${notif.title || "Notice"}: ${notif.body}`, "info", 8000, targetUrl);
      } else {
        // Accumulate read notifications to ignore them
        currentAlerted.add(notif.id);
        seenIdsRef.current.add(notif.id);
      }
    });

    if (newlyDiscovered) {
      // Save state to sessionStorage
      saveAlertedIds(currentAlerted);

      // Play Beep sound TWICE for each arrival event!
      warmUpAudio();
      triggerDoubleChime();
    }

  }, [notifications, isAuthenticated, user, addToast, setUnreadCount]);

  const triggerDoubleChime = () => {
    const playChimeTone = (freq: number, duration: number) => {
      try {
        // Enforce/warm up audio context
        if (!sharedAudioCtx) {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) sharedAudioCtx = new AudioCtx();
        }
        
        if (sharedAudioCtx) {
          if (sharedAudioCtx.state === "suspended") {
            sharedAudioCtx.resume();
          }

          const osc = sharedAudioCtx.createOscillator();
          const gain = sharedAudioCtx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, sharedAudioCtx.currentTime);

          gain.gain.setValueAtTime(0.001, sharedAudioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.20, sharedAudioCtx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, sharedAudioCtx.currentTime + duration - 0.05);

          osc.connect(gain);
          gain.connect(sharedAudioCtx.destination);

          osc.start();
          osc.stop(sharedAudioCtx.currentTime + duration);
        }
      } catch (err) {
        console.warn("Unable to trigger sound due to browser audio lock: ", err);
      }
    };

    // First pleasant high chime note (880 Hz - A5)
    playChimeTone(880, 0.4);

    // Second chime sound played 350 milliseconds later (beep twice per notice!)
    setTimeout(() => {
      playChimeTone(1046.50, 0.4); // C6 highest chime
    }, 350);
  };

  return null;
}
