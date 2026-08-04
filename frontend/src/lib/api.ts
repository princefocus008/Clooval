/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import axios from "axios";

// Central Axios Client
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "";
const isDev = import.meta.env.DEV;

// In local development, always prefer the Vite proxy so auth and other API requests
// use the active backend without depending on a mismatched hard-coded port.
const baseURL = isDev ? "/api" : (API_BASE ? `${API_BASE}/api` : "/api");

if (isDev) {
  console.log("API client baseURL:", baseURL);
}

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 20000,
});

// Attach Authorization Token interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("cl_token");
    if (isDev) {
      console.log("Attaching token:", !!token, "to", config.url);
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isDev) {
      const detail = error.response?.data?.error?.detail || error.response?.data?.error || error.message || "Unknown error";
      console.error(
        "API Error:",
        error.config?.method?.toUpperCase(),
        error.config?.url,
        "→",
        error.response?.status,
        detail
      );
    }

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
