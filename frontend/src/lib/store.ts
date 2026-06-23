/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from "zustand";
import { User } from "../types";

// ==========================================
// Toast Types and Store
// ==========================================
export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  url?: string;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType, duration?: number, url?: string) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = "info", duration = 7000, url) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => {
      // Limit to max 4 toasts, append newest
      const updated = [...state.toasts, { id, message, type, url }];
      if (updated.length > 4) {
        updated.shift();
      }
      return { toasts: updated };
    });

    // Auto dismiss after custom duration (defaults to 7 seconds)
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

// ==========================================
// Auth Store
// ==========================================
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  initialize: () => void;
  updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: (user, token) => {
    localStorage.setItem("cl_token", token);
    localStorage.setItem("cl_user", JSON.stringify(user));
    set({ user, token, isAuthenticated: true, isLoading: false });
  },
  logout: () => {
    localStorage.removeItem("cl_token");
    localStorage.removeItem("cl_user");
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },
  initialize: () => {
    set({ isLoading: true });
    const token = localStorage.getItem("cl_token");
    const userStr = localStorage.getItem("cl_user");
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token, isAuthenticated: true, isLoading: false });
        return;
      } catch (e) {
        localStorage.removeItem("cl_token");
        localStorage.removeItem("cl_user");
      }
    }
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },
  updateUser: (updatedUser) => {
    localStorage.setItem("cl_user", JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },
}));

// ==========================================
// General App Store (Notifications & UI state)
// ==========================================
interface AppState {
  unreadNotificationCount: number;
  setUnreadCount: (count: number) => void;
  decrementUnread: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  unreadNotificationCount: 0,
  setUnreadCount: (count) => set({ unreadNotificationCount: count }),
  decrementUnread: () =>
    set((state) => ({
      unreadNotificationCount: Math.max(0, state.unreadNotificationCount - 1),
    })),
}));


