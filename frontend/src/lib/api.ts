/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import axios from "axios";

// Central Axios Client
const API_BASE = (import.meta.env.VITE_API_URL as string) || "";

// During local development, prefer the active backend dev server if VITE_API_URL isn't set.
const DEV_FALLBACK = (typeof window !== "undefined" && window.location.hostname === "localhost") ? "http://localhost:3012" : "";

export const api = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api` : (DEV_FALLBACK ? `${DEV_FALLBACK}/api` : "/api"),
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 20000,
});

// Attach Authorization Token interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("cl_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercept 401 responses to auto-logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      import("./store").then(({ useAuthStore }) => {
        useAuthStore.getState().logout();
      }).catch(() => {
        localStorage.removeItem("cl_token");
        localStorage.removeItem("cl_user");
      });
      window.location.replace("/login");
    }
    return Promise.reject(error);
  }
);
