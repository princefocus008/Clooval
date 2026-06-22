/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from "react";
import { Outlet, Link, useLocation, Navigate } from "react-router-dom";
import { useAuthStore } from "../../lib/store";
import { useNotifications } from "../../hooks/queries";
import { Home, ClipboardList, Bell, User as UserIcon, LogOut } from "lucide-react";
import Logo from "../Logo";
import GlobalSearch from "../GlobalSearch";
import LoadingSpinner from "../ui/LoadingSpinner";

export default function StudentLayout() {
  const { user, isAuthenticated, initialize, logout } = useAuthStore();
  const location = useLocation();
  const [isRouteChanging, setIsRouteChanging] = React.useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    setIsRouteChanging(true);
    const timer = setTimeout(() => {
      setIsRouteChanging(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Hook to fetch and poll notifications so we get count badge
  const { data: notifications } = useNotifications();
  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

  const [pullY, setPullY] = React.useState(0);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const touchStartRef = React.useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isRefreshing) return;
    const container = e.currentTarget;
    if (container.scrollTop === 0) {
      touchStartRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isRefreshing || touchStartRef.current === null) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartRef.current;
    if (diff > 0) {
      const damp = Math.min(65, diff * 0.4);
      setPullY(damp);
    } else {
      setPullY(0);
    }
  };

  const handleTouchEnd = () => {
    if (isRefreshing) return;
    if (pullY > 45) {
      setIsRefreshing(true);
      setPullY(45);
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } else {
      setPullY(0);
    }
    touchStartRef.current = null;
  };

  if (!isAuthenticated && !localStorage.getItem("cl_token")) {
      return <Navigate to="/login" replace />;
  }

  // Double check admin role. If logged in as admin, they should go to /admin
  if (user && user.role === "admin") {
      return <Navigate to="/admin" replace />;
  }

    // Use relative paths under the student base `/app` so links resolve correctly
    const basePath = "/app";
  const navItems = [
      { label: "Home", path: "", icon: Home },
      { label: "My Requests", path: "requests", icon: ClipboardList },
      { label: "Notifications", path: "notifications", icon: Bell, badge: unreadCount },
      { label: "Profile", path: "profile", icon: UserIcon },
  ];

  return (
    <div className="min-h-screen bg-white text-[#111111] flex flex-col md:flex-row">
      
      {/* DESKTOP SIDEBAR NAVIGATION */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-[#E5E5E3] h-screen sticky top-0 shrink-0">
        <div className="p-6 h-16 flex items-center border-b border-[#E5E5E3]">
            <Logo to="/app" className="-ml-1" />
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
              const fullPath = `${basePath}${item.path ? `/${item.path}` : ""}`;
              const isActive = location.pathname === fullPath || location.pathname.startsWith(fullPath + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[#F7F7F5] text-[#111111] border-l-2 border-[#111111]"
                    : "text-[#555555] hover:text-[#111111] hover:bg-[#F7F7F5]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="bg-[#111111] text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-[#E5E5E3]">
          <div className="flex items-center justify-between p-2 rounded-lg">
            <div className="truncate pr-2">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-[#555555]">Logged in as</p>
              <p className="text-sm font-medium text-[#111111] truncate">{user?.name || "Student"}</p>
            </div>
            <button
              onClick={() => setShowLogoutModal(true)}
              className="bg-[#333333] text-white p-1.5 rounded-md hover:bg-[#1f1f1f] transition cursor-pointer"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN LAYOUT (MOBILE AND DESKTOP CONTENT) */}
      <main 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto pb-20 md:pb-0 h-full flex flex-col relative"
      >
        {/* Pull To Refresh Mobile Indicator */}
        {(pullY > 0 || isRefreshing) && (
          <div 
            className="w-full bg-[#FAF9F6] border-b border-[#E5E5E3] flex justify-center items-center transition-all duration-150 overflow-hidden shrink-0 z-40"
            style={{ height: `${pullY}px` }}
          >
            <LoadingSpinner size="sm" className="py-2" />
          </div>
        )}

        {/* STUDENT HEAD NAVIGATION BAR WITH GLOBAL SEARCH */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#E5E5E3] px-4 md:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="md:hidden">
                <Logo iconOnly to="/app" className="-ml-1" />
            </div>
            <div className="hidden md:block">
              <span className="text-xs font-bold font-mono text-[#999999] uppercase tracking-wider">Cloova Services</span>
            </div>
          </div>

          <div className="flex-1 max-w-sm">
            {location.pathname.startsWith(`${basePath}/requests`) && <GlobalSearch />}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-xs font-bold text-[#111111] leading-none">{user?.name}</span>
            </div>
          </div>
        </header>

        <div className="max-w-[720px] w-full mx-auto p-4 md:p-8 flex-1">
          {isRouteChanging ? (
            <div className="py-20 flex justify-center items-center animate-pulse">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </main>

      {showLogoutModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-[#E5E5E3]">
            <h3 className="text-lg font-semibold text-[#111111]">Confirm log out</h3>
            <p className="text-sm text-[#555555] mt-2">Are you sure you want to sign out of Cloova?</p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 rounded-lg border border-[#E5E5E3] text-sm font-semibold text-[#555555] hover:bg-[#F7F7F5] transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  logout();
                }}
                className="px-4 py-2 rounded-lg bg-[#333333] text-white text-sm font-semibold hover:bg-[#1f1f1f] transition"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#E5E5E3] flex items-center justify-around z-25"
        role="navigation"
        aria-label="Mobile menu"
      >
        {navItems.map((item) => {
            const fullPath = `${basePath}${item.path ? `/${item.path}` : ""}`;
            const isActive = location.pathname === fullPath || location.pathname.startsWith(fullPath + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-full h-full relative transition ${
                isActive ? "text-[#111111]" : "text-[#999999] hover:text-[#555555]"
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-[#111111] text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded min-w-[14px] text-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium mt-1 leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => setShowLogoutModal(true)}
        className="md:hidden fixed left-4 bottom-20 z-30 h-12 w-12 rounded-full bg-white border border-[#E5E5E3] shadow-md flex items-center justify-center text-[#111111] hover:bg-[#F7F7F5] transition"
        aria-label="Open logout dialog"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  );
}
