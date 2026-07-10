/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "./lib/store";
import { syncLocalStorageWithServer } from "./lib/sync";

// UI Helpers
import ToastContainer from "./components/ui/ToastContainer";
import NotificationListener from "./components/NotificationListener";
import PushNotificationManager from "./components/PushNotificationManager";
import PWAInstallBanner from "./components/PWAInstallBanner";
import LoadingSpinner from "./components/ui/LoadingSpinner";

// Layout Wrappers
import StudentLayout from "./components/layout/StudentLayout";
import AdminLayout from "./components/layout/AdminLayout";

// Screen Components
import AuthScreen from "./features/auth/AuthScreen";
import Profile from "./features/auth/Profile";
import VerifyEmail from "./features/auth/VerifyEmail";
import ForgotPassword from "./features/auth/ForgotPassword";
import ResetPassword from "./features/auth/ResetPassword";

import StudentHome from "./features/requests/StudentHome";
import MyRequests from "./features/requests/MyRequests";
import RequestDetails from "./features/requests/RequestDetails";
import ProviderJobCard from "./features/requests/ProviderJobCard";
import { UnifiedRequestFlow } from "./features/requests/guided/GuidedRequestFlow";

import Notifications from "./features/notifications/Notifications";
import LandingPage from "./components/LandingPage";

const AdminOverview = lazy(() => import("./features/admin/AdminOverview"));
const AdminSupportInbox = lazy(() => import("./features/admin/AdminSupportInbox"));
const AdminContactInbox = lazy(() => import("./features/admin/AdminContactInbox"));
const AdminRequestsList = lazy(() => import("./features/admin/AdminRequestsList"));
const AdminRequestDetails = lazy(() => import("./features/admin/AdminRequestDetails"));
const Providers = lazy(() => import("./features/admin/Providers"));
const AdminSettings = lazy(() => import("./features/admin/Settings"));
const UsersAudit = lazy(() => import("./features/admin/UsersAudit"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  const { initialize, isAuthenticated, user, isLoading } = useAuthStore();

  useEffect(() => {
    initialize();
    syncLocalStorageWithServer();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="h-5 w-5 rounded-full border-2 border-[#E5E5E3] border-t-[#111111] animate-spin" />
          </div>
        }>
          <AppRoutes isAuthenticated={isAuthenticated} user={user} />
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function AppRoutes({ isAuthenticated, user }: { isAuthenticated: boolean; user: any }) {
  const location = useLocation();
  const isLandingPage = location.pathname === "/" || location.pathname === "/landing";

  return (
    <>
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Public Auth Portal */}
        <Route path="/login" element={<AuthScreen />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Student Protected Environment */}
        <Route path="/app" element={<StudentLayout />}>
          <Route index element={<StudentHome />} />
          <Route path="requests" element={<MyRequests />} />
          <Route path="requests/new" element={<Navigate to="/app/requests/new/select" replace />} />
          <Route path="requests/new/form" element={<Navigate to="/app/requests/new/select" replace />} />
          <Route path="requests/new/select" element={<UnifiedRequestFlow />} />
          <Route path="requests/new/:category" element={<UnifiedRequestFlow />} />
          <Route path="requests/:id" element={<RequestDetails />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Admin Protected Operations */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="support" element={<AdminSupportInbox />} />
          <Route path="contact" element={<AdminContactInbox />} />
          <Route path="requests" element={<AdminRequestsList />} />
          <Route path="requests/:id" element={<AdminRequestDetails />} />
          <Route path="users" element={<UsersAudit />} />
          <Route path="providers" element={<Providers />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* Public Screenshot/Printable Job Card */}
        <Route path="/job-card/:requestId" element={<ProviderJobCard />} />

        {/* Fallback Catch */}
        <Route
          path="*"
          element={
            isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate to="/admin" replace />
              ) : (
                <Navigate to="/app" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>

      {isLandingPage && <PWAInstallBanner />}
      {isAuthenticated && <NotificationListener />}
      {isAuthenticated && <PushNotificationManager />}
      <ToastContainer />
    </>
  );
}
