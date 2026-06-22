/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Outlet, Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import { useAuthStore, useToastStore } from "../../lib/store";
import { useNotifications, useAdminActivities, useAdminUsers, useSendCustomAlert, useMarkNotificationsRead, useMarkNotificationRead } from "../../hooks/queries";
import { 
  LayoutDashboard, 
  ClipboardList, 
  Users, 
  Settings, 
  LogOut, 
  Bell, 
  HelpCircle,
  X,
  UserCheck,
  ArrowRight,
  Search,
  ChevronDown,
  User,
  ExternalLink,
  MessageSquare,
  Sparkles
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Logo from "../Logo";
import LoadingSpinner from "../ui/LoadingSpinner";

export default function AdminLayout() {
  const { user, isAuthenticated, initialize, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isRouteChanging, setIsRouteChanging] = useState(false);

  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const { data: notifications } = useNotifications();
  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

  const markAllRead = useMarkNotificationsRead();
  const markNotificationRead = useMarkNotificationRead();

  // Live activities feed
  const { data: adminActivities } = useAdminActivities();
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [dropdownTab, setDropdownTab] = useState<"activities" | "notifications">("activities");
  const [lastSeenActivityCount, setLastSeenActivityCount] = useState<number>(() => {
    return Number(localStorage.getItem("cloova_seen_activities_count") || "0");
  });

  useEffect(() => {
    // Do not auto-mark notifications as read when opening the dropdown.
    if (!showNotificationDropdown || dropdownTab !== "notifications" || !notifications) {
      return;
    }

    // Intentionally do nothing here: marking should be explicit by user action.
  }, [showNotificationDropdown, dropdownTab, notifications, markAllRead]);

  // Removed the automatic effect that instantly clears incoming notifications on overview load,
  // resolving cross-device sync issues and ensuring real-time notification alerts pop on screen.

  // Calculate unseen activities
  const unseenActivitiesCount = adminActivities && adminActivities.length > lastSeenActivityCount
    ? adminActivities.length - lastSeenActivityCount
    : 0;

  const handleToggleDropdown = () => {
    setShowNotificationDropdown((prev) => !prev);
    if (!showNotificationDropdown) {
      setDropdownTab("activities");
      if (adminActivities) {
        setLastSeenActivityCount(adminActivities.length);
        localStorage.setItem("cloova_seen_activities_count", adminActivities.length.toString());
      }
    }
  };

  // User Search & Actions portal
  const [showSearchPortal, setShowSearchPortal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedAuditUserId, setSelectedAuditUserId] = useState<string | null>(null);
  const [quickAlertMessage, setQuickAlertMessage] = useState("");

  const { data: allUsers } = useAdminUsers();
  const sendAlertMutation = useSendCustomAlert();
  const { addToast } = useToastStore();

  const filteredUsers = allUsers?.filter(u => {
    const q = userSearchQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.studentId?.toLowerCase().includes(q)
    );
  }).slice(0, 5) || [];

  const selectedAuditUser = allUsers?.find(u => u.id === selectedAuditUserId) || null;

  const handleSendQuickAlert = (userId: string) => {
    if (!quickAlertMessage.trim()) {
      addToast("Please write a message.", "error");
      return;
    }
    sendAlertMutation.mutate(
      {
        id: userId,
        title: "Direct Admin Dispatch Note",
        message: quickAlertMessage,
      },
      {
        onSuccess: () => {
          setQuickAlertMessage("");
          addToast("Urgent system notice broadcasted successfully!", "success");
        },
        onError: (err: any) => {
          addToast(err.message || "Failed to broadcast alert", "error");
        }
      }
    );
  };

  if (!isAuthenticated && !localStorage.getItem("cl_token")) {
    return <Navigate to="/login" replace />;
  }

  // Authorize Admin only
  if (user && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const menuItems = [
    { label: "Overview", path: "/admin", icon: LayoutDashboard },
    { label: "Requests", path: "/admin/requests", icon: ClipboardList },
    { label: "Users", path: "/admin/users", icon: Users },
    { label: "Providers", path: "/admin/providers", icon: UserCheck },
    { label: "Settings", path: "/admin/settings", icon: Settings },
  ];

  const userInitials = user?.name 
    ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "CE";

  return (
    <div className="min-h-screen bg-[#F8F8F6] text-[#111111] flex flex-col md:flex-row font-sans">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-52 bg-white border-r border-[#E5E5E3] h-screen sticky top-0 shrink-0">
        
        {/* TOP BRANDING UNIT */}
        <div className="p-4 h-18 flex items-center border-b border-[#E5E5E3]">
          <Logo to="/admin" className="-ml-1" />
        </div>
        
        {/* NAVIGATION SYSTEM */}
        <nav className="flex-1 py-6 space-y-1">
          {menuItems.map((item) => {
            const isActive =
              item.path === "/admin"
                ? location.pathname === "/admin"
                : location.pathname.startsWith(item.path);

            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between pl-6 pr-4 py-3 text-[13px] tracking-tight transition-all relative ${
                  isActive
                    ? "bg-[#F5F5F3]/80 text-[#111111] font-semibold border-r-[4px] border-[#111111]"
                    : "text-[#555555] hover:text-[#111111] hover:bg-[#F9F9F7]"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon className="w-[18px] h-[18px] shrink-0 opacity-85" />
                  <span>{item.label}</span>
                </div>
                {item.label === "Overview" && unreadCount > 0 && (
                  <span className="bg-[#E74C3C] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* BOTTOM METADATA UNIT */}
        <div className="p-4 border-t border-[#E5E5E3] space-y-3">
          <div className="flex items-center gap-3 p-1.5">
            {/* Round Avatar Picture Representative */}
            <div className="w-[32px] h-[32px] rounded-full bg-slate-900 border border-[#E5E5E3] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {userInitials}
            </div>
            <div className="truncate flex-1">
              <p className="text-[12px] font-bold text-[#111111] leading-none truncate">{user?.name || "Cloova Operator"}</p>
              <p className="text-[10px] text-[#999999] mt-0.5 leading-none">System Admin</p>
            </div>
            <button
              onClick={() => setShowLogoutModal(true)}
              className="bg-[#333333] text-white p-1 rounded hover:bg-[#1f1f1f] transition cursor-pointer shrink-0"
              title="Log out of console"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE BAR */}
      <header className="md:hidden h-16 bg-white border-b border-[#E5E5E3] px-6 flex items-center justify-between sticky top-0 z-30">
        <span className="font-bold text-sm tracking-tight flex items-center gap-4 text-black">
          <Logo iconOnly to="/" className="-ml-1" /> Admin Console
        </span>

        {/* Small floating navigation bar */}
        <div className="flex items-center gap-2">
          {menuItems.map((item) => {
            const isActive =
              item.path === "/admin"
                ? location.pathname === "/admin"
                : location.pathname.startsWith(item.path);

            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`p-2 rounded-md transition ${isActive ? "bg-[#F5F5F3] text-[#111111]" : "text-[#999999] hover:text-black"}`}
                title={item.label}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" />
              </Link>
            );
          })}
          <button
            onClick={() => setShowLogoutModal(true)}
            className="p-2 bg-[#333333] text-white rounded hover:bg-[#1f1f1f] transition"
            title="Log out"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {showLogoutModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-[#E5E5E3]">
            <h3 className="text-lg font-semibold text-[#111111]">Log out confirmation</h3>
            <p className="text-sm text-[#555555] mt-2">Are you sure you want to leave the admin console?</p>
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

      {/* ADMIN UTILITY WRAPPER (MAIN WITH HEADER ROW) */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* UPPER ACTION HEADER (SPANS WIDTH OF CONTENT REGION ON DESKTOP) */}
        <header className="hidden md:flex h-18 bg-white border-b border-[#E5E5E3] px-8 items-center justify-end gap-5 shrink-0 relative">
          
          {/* User search bar and action console */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSearchPortal((prev) => !prev);
                setShowNotificationDropdown(false);
              }}
              className="p-1.5 text-[#555555] hover:text-black rounded-lg hover:bg-[#F5F5F3] transition relative cursor-pointer block"
              title="Search Users & Auditing Console"
            >
              <Search className="w-[19px] h-[19px]" />
            </button>

            {showSearchPortal && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowSearchPortal(false)} />
                <div className="absolute right-0 mt-2.5 w-[420px] bg-white border border-[#E5E5E3] rounded-xl shadow-xl z-40 overflow-hidden text-left animate-slide-up flex flex-col max-h-[520px]">
                  {/* Header */}
                  <div className="p-4 bg-[#FAF9F6] border-b border-[#E5E5E3] flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-neutral-800" />
                      <h4 className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#111111]">
                        ADMINISTRATIVE USER AUDIT PORTAL
                      </h4>
                    </div>
                    {selectedAuditUserId && (
                      <button
                        onClick={() => setSelectedAuditUserId(null)}
                        className="text-[9px] font-extrabold text-[#777777] uppercase tracking-wider hover:text-black hover:underline cursor-pointer"
                      >
                        Reset Selection
                      </button>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {!selectedAuditUserId ? (
                      <div className="space-y-3">
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <Search className="h-3.5 w-3.5 text-[#999999]" />
                          </span>
                          <input
                            type="text"
                            placeholder="Type name, email, or resident ID..."
                            value={userSearchQuery}
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 h-9 bg-[#FAF9F6] border border-[#E5E5E3] rounded-lg text-xs placeholder-[#999999] focus:outline-none focus:border-black transition font-semibold"
                            autoFocus
                          />
                        </div>

                        <div className="space-y-1">
                          {filteredUsers.length > 0 ? (
                            filteredUsers.map((u) => (
                              <button
                                key={u.id}
                                onClick={() => {
                                  setSelectedAuditUserId(u.id);
                                  setQuickAlertMessage("");
                                }}
                                className="w-full p-2.5 rounded-lg border border-transparent hover:border-[#E5E5E3] hover:bg-[#FAF9F7] transition text-left flex items-center justify-between cursor-pointer"
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <p className="text-xs font-bold text-black truncate">{u.name}</p>
                                  <p className="text-[10px] text-[#777777] font-mono truncate">{u.email}</p>
                                </div>
                                <ChevronDown className="w-3.5 h-3.5 text-[#999999] shrink-0" />
                              </button>
                            ))
                          ) : (
                            <p className="text-center text-[11px] text-[#999999] py-8 italic">
                              Type a student to perform checklist diagnostics
                            </p>
                          )}
                        </div>
                      </div>
                    ) : selectedAuditUser ? (
                      <div className="space-y-4 text-left">
                        {/* Selected info card */}
                        <div className="p-3 bg-[#FAF9F6] border border-[#E5E5E3] rounded-lg space-y-1.5">
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-xs font-extrabold text-black uppercase">{selectedAuditUser.name}</span>
                            <span className="text-[9px] font-mono bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded border border-[#E5E5E3]">
                              {selectedAuditUser.resident || "Off-Campus"}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#555555] font-mono">{selectedAuditUser.email}</p>
                          <p className="text-[10px] text-[#999999] font-mono leading-none">Resident ID: {selectedAuditUser.studentId || "N/A"}</p>
                        </div>

                        {/* Recent Activites Ledger */}
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-extrabold text-[#777777] uppercase tracking-wider block">
                            Ledger History ({selectedAuditUser.activities?.length || 0} events)
                          </span>
                          <div className="border border-[#E7E7E3] rounded-lg max-h-[140px] overflow-y-auto divide-y divide-[#F5F5F3] bg-[#FAF9F6]">
                            {selectedAuditUser.activities && selectedAuditUser.activities.length > 0 ? (
                              selectedAuditUser.activities.slice(0, 5).map((act: any, idx: number) => (
                                <div key={idx} className="p-2.5 text-left space-y-0.5">
                                  <div className="flex justify-between items-center text-[9px] text-[#999999]">
                                    <span className="font-mono uppercase font-bold text-neutral-600 bg-neutral-100 border border-neutral-200 px-1 rounded text-[8px] leading-none">
                                      {act.action}
                                    </span>
                                    <span className="font-mono text-[9px]">
                                      {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[#111111] font-semibold leading-relaxed">
                                    {act.details}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="p-4 text-center text-xs text-[#999999] italic">
                                No logged activities on this student account.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Active Repid Repairs List */}
                        {selectedAuditUser.requests && selectedAuditUser.requests.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[9px] font-extrabold text-[#777777] uppercase tracking-wider block">
                              Associated Repair Orders
                            </span>
                            <div className="divide-y divide-[#E5E5E3]">
                              {selectedAuditUser.requests.map((req: any) => (
                                <div key={req.id} className="py-2 flex items-center justify-between text-xs">
                                  <div className="min-w-0 flex-1 pr-2">
                                    <p className="font-semibold text-black truncate">{req.description}</p>
                                    <p className="text-[10px] text-[#999999] font-mono">Code #{req.id} • {req.category}</p>
                                  </div>
                                  <span className="text-[9px] font-bold uppercase py-0.5 px-1.5 rounded bg-[#F1F2E9] border border-[#E5E5E3] text-[#111111] shrink-0 font-mono">
                                    {req.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Direct action checklist trigger and Quick alert broadcast */}
                        <div className="pt-3 border-t border-[#E5E5E3] space-y-2">
                          <span className="text-[9px] font-extrabold text-[#555555] uppercase tracking-wider block">
                            Direct In-App Operational Actions
                          </span>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Type direct custom warning or notice..."
                                value={quickAlertMessage}
                                onChange={(e) => setQuickAlertMessage(e.target.value)}
                                className="flex-1 px-2 py-1.5 bg-[#FAF9F6] border border-[#E5E5E3] rounded text-xs placeholder-[#999999] focus:outline-none focus:border-black font-semibold h-8"
                              />
                              <button
                                onClick={() => handleSendQuickAlert(selectedAuditUser.id)}
                                disabled={sendAlertMutation.isPending}
                                className="h-8 px-3 bg-[#111111] text-white font-mono uppercase text-[9px] tracking-wider rounded font-bold hover:bg-[#333333] transition cursor-pointer disabled:opacity-40 select-none"
                              >
                                {sendAlertMutation.isPending ? "Pushed" : "Push"}
                              </button>
                            </div>

                            <Link
                              to="/admin/users"
                              onClick={() => {
                                setShowSearchPortal(false);
                              }}
                              className="w-full h-8 border border-[#E5E5E3] hover:border-black rounded transition flex items-center justify-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#111111] bg-white cursor-pointer"
                            >
                              <span>Open Comprehensive Auditing Sheet</span>
                              <ExternalLink className="w-3 h-3 text-[#555555] shrink-0" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Footer */}
                  <div className="p-3 bg-[#FAF9F6] border-t border-[#E5E5E3] text-center shrink-0">
                    <p className="text-[9px] font-mono text-[#999999]">
                      Direct Console Dispatcher • Cloova Lockers Maurititus
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Notifications bell */}
          <div className="relative">
            <button 
              onClick={handleToggleDropdown}
              className="p-1.5 text-[#555555] hover:text-black rounded-lg hover:bg-[#F5F5F3] transition relative cursor-pointer block"
              title="System Alerts & Activities (Real-Time)"
            >
              <Bell className="w-[19px] h-[19px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white font-mono text-[9px] font-bold w-4.5 h-4.5 flex items-center justify-center rounded-full animate-bounce border border-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* FLOATING REAL-TIME SYSTEM ACTIVITIES POPUP */}
            {showNotificationDropdown && (
              <>
                {/* Backdrop clicks close dropdown */}
                <div className="fixed inset-0 z-30" onClick={() => setShowNotificationDropdown(false)} />
                
                <div className="absolute right-0 mt-2.5 w-96 bg-white border border-[#E5E5E3] rounded-xl shadow-xl z-40 overflow-hidden animate-slide-up">
                  {/* Header/Tab Bar */}
                  <div className="p-3.5 bg-[#FAF9F6] border-b border-[#E5E5E3] flex justify-between items-center text-left">
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setDropdownTab("activities")}
                        className={`text-[10px] font-extrabold uppercase tracking-[0.08em] pb-1 border-b-2 transition ${
                          dropdownTab === "activities"
                            ? "border-black text-black"
                            : "border-transparent text-[#999999] hover:text-[#555555]"
                        }`}
                      >
                        System Logs
                      </button>
                      <button
                        type="button"
                        onClick={() => setDropdownTab("notifications")}
                        className={`text-[10px] font-extrabold uppercase tracking-[0.08em] pb-1 border-b-2 transition relative ${
                          dropdownTab === "notifications"
                            ? "border-black text-black"
                            : "border-transparent text-[#999999] hover:text-[#555555]"
                        }`}
                      >
                        Student Notices
                        {unreadCount > 0 && (
                          <span className="ml-1 px-1.5 py-0.2 text-[8px] bg-red-600 text-white font-bold rounded font-mono">
                            {unreadCount}
                          </span>
                        )}
                      </button>
                    </div>

                    {dropdownTab === "activities" ? (
                      <button
                        onClick={() => {
                          if (adminActivities) {
                            setLastSeenActivityCount(adminActivities.length);
                            localStorage.setItem("cloova_seen_activities_count", adminActivities.length.toString());
                          }
                          setShowNotificationDropdown(false);
                        }}
                        className="text-[9px] font-bold text-[#777777] hover:text-black underline cursor-pointer"
                      >
                        Clear Counters
                      </button>
                    ) : (
                      unreadCount > 0 && (
                        <button
                          onClick={() => {
                            markAllRead.mutate();
                          }}
                          className="text-[9px] font-bold text-[#777777] hover:text-black underline cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )
                    )}
                  </div>

                  {/* Body Scrollbar wrapper */}
                  <div className="max-h-[360px] overflow-y-auto divide-y divide-[#F5F5F3]">
                    {dropdownTab === "activities" ? (
                      adminActivities && adminActivities.length > 0 ? (
                        adminActivities.slice(0, 10).map((act, index) => {
                          const dateText = formatDistanceToNow(new Date(act.createdAt || Date.now()), { addSuffix: true });
                          const systemAction = act.action || "Log";
                          return (
                            <div key={act.id || index} className="p-3.5 hover:bg-[#FAF9F7] transition cursor-pointer text-left">
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-mono text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-700 leading-none shrink-0 select-none">
                                  {systemAction}
                                </span>
                                <span className="text-[9px] font-mono text-[#999999] shrink-0">{dateText}</span>
                              </div>
                              <p className="text-xs text-[#333333] font-semibold mt-1.5 leading-relaxed">
                                {act.details}
                              </p>
                              {act.requestId && (
                                <Link
                                  to={`/admin/requests/${act.requestId}`}
                                  onClick={() => setShowNotificationDropdown(false)}
                                  className="inline-flex items-center gap-1 text-[9px] font-mono text-blue-600 hover:underline mt-1 leading-none font-bold"
                                >
                                  View related repair plan →
                                </Link>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-8 text-center text-xs text-[#999999] italic">
                          No recent system activities logged.
                        </div>
                      )
                    ) : (
                      notifications && notifications.length > 0 ? (
                        notifications.map((notif, index) => {
                          const dateText = formatDistanceToNow(new Date(notif.createdAt || Date.now()), { addSuffix: true });
                          return (
                            <div 
                              key={notif.id || index} 
                              className={`p-3.5 transition cursor-pointer text-left ${
                                !notif.isRead ? "bg-[#F1F2E9] hover:bg-[#EBECE2]" : "hover:bg-[#FAF9F7]"
                              }`}
                              onClick={() => {
                                if (!notif.isRead) {
                                  markNotificationRead.mutate(notif.id);
                                }
                                if (notif.requestId) {
                                  navigate(`/admin/requests/${notif.requestId}`);
                                  setShowNotificationDropdown(false);
                                }
                              }}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <span className={`text-[12px] font-bold ${!notif.isRead ? "text-[#111111]" : "text-[#555555]"}`}>
                                  {notif.title}
                                </span>
                                <span className="text-[9px] font-mono text-[#999999] shrink-0">{dateText}</span>
                              </div>
                              <p className="text-xs text-[#444444] mt-1 leading-relaxed">
                                {notif.body}
                              </p>
                              {notif.requestId && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-mono text-blue-600 hover:underline mt-1.5 leading-none font-bold block">
                                  View Linked Request #{notif.requestId} →
                                </span>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-8 text-center text-xs text-[#999999] italic">
                          No system alerts or student notices found.
                        </div>
                      )
                    )}
                  </div>

                  {/* Footer links */}
                  <div className="p-3.5 bg-[#FAF9F6] border-t border-[#E5E5E3] text-center">
                    <Link
                      to="/admin/users"
                      onClick={() => setShowNotificationDropdown(false)}
                      className="text-[10px] font-extrabold uppercase tracking-widest text-[#111111] hover:underline inline-flex items-center gap-1.5"
                    >
                      <span>Launch User Auditing Console</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Help Center icon */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="p-1.5 text-[#555555] hover:text-black rounded-lg hover:bg-[#F5F5F3] transition cursor-pointer"
            title="Help & Info"
          >
            <HelpCircle className="w-[19px] h-[19px]" />
          </button>

          {/* Initials bubble */}
          <div className="w-[30px] h-[30px] rounded-full bg-[#111111] text-white flex items-center justify-center text-xs font-bold tracking-wider select-none shrink-0 border border-black shadow">
            {userInitials}
          </div>
        </header>

        {/* MAIN BODY WINDOW */}
        <main 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex-1 p-6 md:p-8 overflow-y-auto relative" 
          id="admin-main"
        >
          {/* Pull To Refresh Mobile Indicator */}
          {(pullY > 0 || isRefreshing) && (
            <div 
              className="w-full bg-[#FAF9F6] border border-[#E5E5E3] rounded-xl flex justify-center items-center transition-all duration-150 overflow-hidden shrink-0 z-40 mb-4"
              style={{ height: `${pullY}px` }}
            >
              <LoadingSpinner size="sm" className="py-2" />
            </div>
          )}

          <div className="max-w-5xl mx-auto">
            {isRouteChanging ? (
              <div className="py-24 flex justify-center items-center animate-pulse">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>

      {/* HELP POPUP SCREEN */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E5E5E3] shadow-xl w-full max-w-sm overflow-hidden animate-slide-up">
            <div className="p-5 border-b border-[#E5E5E3] flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center gap-1.5">
                <HelpCircle className="w-4.5 h-4.5 text-black" />
                Help & Information
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-lg text-[#999999] hover:text-[#111111] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3.5 text-xs text-[#555555] leading-relaxed">
              <p>
                Welcome back to the <strong>Cloova Repair Console</strong>. This system processes Mauritian university repair jobs.
              </p>
              <div>
                <h4 className="font-semibold text-black uppercase tracking-wider text-[10px] mb-1">Status Stages:</h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Pending Review:</strong> Items submitted by students.</li>
                  <li><strong>Awaiting Quote:</strong> Invoiced cost sent for confirmation.</li>
                  <li><strong>Ready Collection:</strong> Repaired item in the Cloova locker drop off.</li>
                </ul>
              </div>
              <p className="bg-[#FEF9E7] border border-[#F39C12]/20 p-2.5 rounded text-amber-900 leading-tight">
                For rapid local repairs, click 'Generate provider card' inside any job claim. Provide screenshots of translated Creole specs directly to workshop mechanics!
              </p>
            </div>
            <div className="p-4 bg-[#F9F9F7] border-t border-[#E5E5E3] flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-3.5 py-1.5 bg-black hover:bg-neutral-800 text-white rounded text-xs font-bold transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
