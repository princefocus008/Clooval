/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRequests, useNotifications, useAdminUsers, useAdminActivities } from "../../hooks/queries";
import { Clock, AlertTriangle, CheckSquare, Inbox, Calendar, ArrowRight, Search, User, MapPin, Mail, Phone, BookOpen, Activity, ListFilter, Bell, ChevronLeft, ChevronRight, RefreshCw, Filter } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Skeleton from "../../components/ui/Skeleton";
import AdminOverviewSkeleton from "../../components/ui/AdminOverviewSkeleton";
import { StatusBadge } from "../../components/ui/Badge";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function AdminOverview() {
  const navigate = useNavigate();
  const { data: requests, isLoading: requestsLoading, error: requestsError } = useRequests();
  const { data: adminUsers, isLoading: usersLoading } = useAdminUsers();
  const { data: adminActivities, isLoading: activitiesLoading } = useAdminActivities();

  const [activeTab, setActiveTab] = useState<"priority" | "users">("priority");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // States for live operational activity logs with date/time selectors & pagination
  const [activityDate, setActivityDate] = useState<string>("");
  const [activityTimeRange, setActivityTimeRange] = useState<string>("all");
  const [activityPage, setActivityPage] = useState<number>(1);
  const itemsPerPage = 6;

  // Filter activities based on date selected and hourly range selected
  const filteredActivities = (adminActivities || []).filter((act) => {
    if (!act || !act.createdAt) return false;
    // 1. Specific Date Check
    if (activityDate) {
      const logDate = act.createdAt.substring(0, 10); // "YYYY-MM-DD"
      if (logDate !== activityDate) return false;
    }
    // 2. Specific Time Block Range Check
    if (activityTimeRange !== "all") {
      const hours = new Date(act.createdAt).getHours();
      if (activityTimeRange === "morning" && (hours < 6 || hours >= 12)) return false;
      if (activityTimeRange === "afternoon" && (hours < 12 || hours >= 18)) return false;
      if (activityTimeRange === "evening" && (hours < 18 || hours >= 24)) return false;
      if (activityTimeRange === "night" && (hours < 0 || hours >= 6)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / itemsPerPage));
  const clampedPage = Math.min(activityPage, totalPages);
  const startIndex = (clampedPage - 1) * itemsPerPage;
  const paginatedActivities = filteredActivities.slice(startIndex, startIndex + itemsPerPage);

  // Metric computations based on request database
  const totalOpen = requests?.filter((r) => r.status !== "completed" && r.status !== "cancelled").length || 0;
  const pendingReview = requests?.filter((r) => r.status === "submitted" || r.status === "under_review").length || 0;
  const awaitingQuote = requests?.filter((r) => r.status === "quote_sent").length || 0;
  const readyPickup = requests?.filter((r) => r.status === "ready_for_collection").length || 0;

  // Urgent and high priority requests: status is not completed/cancelled
  const priorityRequests = requests
    ?.filter((r) => r.status !== "completed" && r.status !== "cancelled")
    .map(r => {
      const created = new Date(r.createdAt);
      const diffTime = Math.abs(Date.now() - created.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return { ...r, daysOpen: diffDays };
    })
    .sort((a, b) => b.daysOpen - a.daysOpen) || []; // longest open first for urgency

  // Helper for priority badges matching mockup exactly
  const renderPriorityLabel = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "urgent":
        return <span className="text-xs uppercase font-semibold text-[#111111]">URGENT</span>;
      case "high":
        return <span className="text-xs uppercase font-medium text-[#555555]">HIGH</span>;
      case "normal":
      case "medium":
        return <span className="text-xs uppercase font-normal text-[#999999]">NORMAL</span>;
      case "low":
      default:
        return <span className="text-xs uppercase font-normal text-[#999999]">LOW</span>;
    }
  };

  // Search logic: by id, email, or name
  const filteredUsers = adminUsers?.filter(u => {
    const q = searchQuery.toLowerCase();
    return (
      u.id?.toLowerCase().includes(q) ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.studentId?.toLowerCase().includes(q)
    );
  }) || [];

  const selectedUserObj = adminUsers?.find(u => u.id === selectedUserId) || null;

  if (requestsLoading || usersLoading || activitiesLoading) {
    return <AdminOverviewSkeleton />;
  }

  return (
    <div className="space-y-8 animate-slide-up">
      
      {/* OVERVIEW TITLE HEADER */}
      <div className="flex justify-between items-start">
        <div className="text-left">
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]" id="page-title">Overview</h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#999999] mt-1 flex items-center gap-1.5 justify-start">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            {format(new Date(), "EEEE, d MMMM yyyy")}
          </p>
        </div>
      </div>

      {/* METRIC TILES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-b border-[#E5E5E3] pb-6">
        {[
          { label: "OPEN REQUESTS", value: totalOpen },
          { label: "PENDING REVIEW", value: pendingReview },
          { label: "AWAITING QUOTE", value: awaitingQuote },
          { label: "READY FOR PICKUP", value: readyPickup }
        ].map((tile, idx) => (
          <div
            key={idx}
            className="py-2 text-left"
          >
            {requestsLoading ? (
              <div className="space-y-2">
                <Skeleton width="60px" height="12px" />
                <Skeleton width="40px" height="28px" />
              </div>
            ) : (
              <>
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#999999] leading-none mb-2">
                  {tile.label}
                </div>
                <div className="text-3xl font-extrabold tracking-tight text-[#111111] leading-none">
                  {tile.value}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* CORE WORKSPACE GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN (2/3 width) - PRIORITY QUEUE & USER TRACKER */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* TAB BAR SELECTOR */}
          <div className="flex border-b border-[#E5E5E3] gap-2">
            <button
              onClick={() => setActiveTab("priority")}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
                activeTab === "priority"
                  ? "border-black text-black"
                  : "border-transparent text-[#999999] hover:text-[#555555]"
              }`}
            >
              Priority Queue
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "users"
                  ? "border-black text-black"
                  : "border-transparent text-[#999999] hover:text-[#555555]"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>User Footprint Audit</span>
            </button>
          </div>

          {/* TAB 1 CONTENT: PRIORITY QUEUE */}
          {activeTab === "priority" && (
            <div className="space-y-3">
              {requestsLoading ? (
                <div className="space-y-3 bg-white border border-[#E5E5E3] rounded-lg p-4">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="py-2.5 flex justify-between border-b last:border-b-0 border-[#F5F5F3]">
                      <Skeleton width="180px" height="14px" />
                      <Skeleton width="60px" height="14px" />
                    </div>
                  ))}
                </div>
              ) : requestsError ? (
                <div className="p-4 bg-red-50 text-red-600 rounded-lg text-xs font-medium text-left">
                  Failed to load system priorities.
                </div>
              ) : priorityRequests.length > 0 ? (
                <div className="divide-y divide-[#E5E5E3]">
                  {priorityRequests.slice(0, 8).map((req) => (
                    <div
                      key={req.id}
                      onClick={() => navigate(`/admin/requests/${req.id}`)}
                      className="py-4 flex items-center justify-between hover:bg-[#F9F9F7] transition cursor-pointer text-left"
                    >
                      <div className="space-y-1.5 pr-4 flex-1">
                        <div className="flex items-center gap-2.5">
                          {renderPriorityLabel(req.priority)}
                          <span className="text-xs font-semibold text-black">{req.studentName}</span>
                        </div>
                        <div className="text-xs text-[#555555] line-clamp-1 leading-snug">
                          <span className="font-semibold text-black capitalize">{req.category} Repair</span>
                          {req.description && ` ${req.description}`}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-xs ${req.daysOpen >= 3 ? "font-semibold text-black" : "text-[#999999]"}`}>
                          {req.daysOpen === 0 ? "Today" : `${req.daysOpen} Day${req.daysOpen === 1 ? "" : "s"} open`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center space-y-1">
                  <CheckSquare className="w-8 h-8 text-[#27AE60] mx-auto shrink-0 mb-1" />
                  <p className="text-xs font-bold text-[#111111]">Pristine Priority Queue</p>
                  <p className="text-[11px] text-[#999999]">No open jobs are marked as urgent or high priority currently.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2 CONTENT: USER FOOTPRINT AUDITING SEARCH */}
          {activeTab === "users" && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              
              {/* Master Search Bar (Left side column of search) */}
              <div className="md:col-span-2 space-y-3">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="h-3.5 w-3.5 text-[#999999]" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search by name, ID, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 h-10 bg-white border border-[#E5E5E3] rounded-lg text-xs placeholder-[#999999] focus:outline-none focus:border-black transition font-medium"
                  />
                </div>

                {usersLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} width="100%" height="48px" />
                    ))}
                  </div>
                ) : filteredUsers.length > 0 ? (
                  <div className="divide-y divide-[#E5E5E3] max-h-[440px] overflow-y-auto">
                    {filteredUsers.map((u) => {
                      const isSelected = u.id === selectedUserId;
                      return (
                        <div
                          key={u.id}
                          onClick={() => setSelectedUserId(u.id)}
                          className={`p-3 cursor-pointer text-left transition select-none flex items-center justify-between ${
                            isSelected ? "bg-[#F5F5F3]" : "hover:bg-[#FAF9F7]"
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs font-bold text-black tracking-tight leading-tight truncate">{u.name}</p>
                            <p className="text-[10px] text-[#777777] font-mono leading-tight truncate mt-0.5">{u.email}</p>
                          </div>
                          <span className="text-[9px] font-bold bg-[#E5E5E3]/40 border border-[#E5E5E3] px-2 py-0.5 rounded shrink-0 text-[#555555] font-mono">
                            {u.studentId || "Admin"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-xs font-bold text-black">No matches found</p>
                    <p className="text-[10px] text-[#999999] mt-0.5">Try refining your search queries.</p>
                  </div>
                )}
              </div>
 
              {/* Detail Auditor Display (Right side screen of search) */}
              <div className="md:col-span-3 min-h-[380px] flex flex-col space-y-6 pt-2 pb-6">
                {selectedUserObj ? (
                  <div className="space-y-6 text-left flex-1 animate-fade-in">
                    
                    {/* Header Detail */}
                    <div className="flex gap-4 border-b border-[#E5E5E3] pb-4">
                      <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-white text-sm font-extrabold shadow-sm shrink-0 uppercase">
                        {selectedUserObj.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div className="min-w-0 text-left">
                        <h4 className="text-sm font-extrabold text-black tracking-tight truncate leading-tight uppercase">
                          {selectedUserObj.name}
                        </h4>
                        <p className="text-xs text-[#555555] font-semibold mt-0.5">{selectedUserObj.email}</p>
                        <div className="flex gap-1.5 flex-wrap mt-2">
                          <span className="inline-flex items-center gap-1 bg-[#F1F2E9] border border-[#E5E5E3] px-2 py-0.5 rounded text-[10px] font-medium text-[#111111] leading-none uppercase font-mono">
                            ID: {selectedUserObj.studentId || selectedUserObj.id}
                          </span>
                          <span className="inline-flex items-center gap-1 bg-[#F1F2E9] border border-[#E5E5E3] px-2 py-0.5 rounded text-[10px] font-medium text-[#111111] leading-none uppercase font-mono">
                            Loc: {selectedUserObj.resident || "N/A"}
                          </span>
                          <span className="inline-flex items-center gap-1 bg-[#F1F2E9] border border-[#E5E5E3] px-2 py-0.5 rounded text-[10px] font-medium text-[#111111] leading-none uppercase font-mono">
                            Role: {selectedUserObj.role}
                          </span>
                        </div>
                      </div>
                    </div>
 
                    {/* Metadata summary (including requests stats) */}
                    <div className="grid grid-cols-2 gap-4 pb-4">
                      <div className="text-left">
                        <span className="block text-[9px] font-bold text-[#999999] uppercase tracking-wider">Total Claims Logged</span>
                        <span className="text-lg font-extrabold text-black font-sans leading-none mt-1 block">
                          {selectedUserObj.totalServiceRequested || 0}
                        </span>
                      </div>
                      <div className="text-left">
                        <span className="block text-[9px] font-bold text-[#999999] uppercase tracking-wider">Contact Phone</span>
                        <span className="text-xs font-bold text-[#111111] mt-1 block font-mono">
                          {selectedUserObj.phone || "No phone linked"}
                        </span>
                      </div>
                    </div>
 
                    {/* Service requested list */}
                    <div className="space-y-2 text-left">
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-[#555555] border-b border-[#E5E5E3] pb-1">
                        All Claims Registered ({selectedUserObj.requests?.length || 0})
                       </h5>
                      {selectedUserObj.requests && selectedUserObj.requests.length > 0 ? (
                        <div className="max-h-[140px] overflow-y-auto divide-y divide-[#E5E5E3]">
                           {selectedUserObj.requests.map((req: any) => (
                             <Link
                               key={req.id}
                               to={`/admin/requests/${req.id}`}
                               className="p-2.5 hover:bg-[#F9F9F7] flex items-center justify-between text-xs transition"
                             >
                               <div className="min-w-0 pr-2 flex-1 text-left">
                                 <span className="font-mono font-bold text-black hover:underline shrink-0 inline">#{req.id}</span>
                                 <span className="text-[#555555] font-medium leading-relaxed truncate ml-2 inline capitalize">
                                   {req.category} Fix ({req.description})
                                 </span>
                               </div>
                               <StatusBadge value={req.status} />
                             </Link>
                           ))}
                         </div>
                       ) : (
                        <p className="text-[10px] text-[#999999] italic">This user has not registered any service requests.</p>
                      )}
                    </div>
 
                    {/* Chronological timeline foot-print */}
                    <div className="space-y-2 text-left">
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-[#555555] border-b border-[#E5E5E3] pb-1">
                        Action Footprint & Audit Stream ({selectedUserObj.activities?.length || 0})
                      </h5>
                      {selectedUserObj.activities && selectedUserObj.activities.length > 0 ? (
                        <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1">
                          {selectedUserObj.activities.map((act: any) => (
                            <div key={act.id} className="py-3 border-b border-[#E5E5E3] text-xs space-y-1.5 last:border-0">
                              <div className="flex justify-between items-center text-left">
                                <span className="font-bold text-[#111111] uppercase tracking-wider font-mono text-[10px]">
                                   {act.action}
                                 </span>
                                <span className="text-[10px] text-[#999999] font-mono shrink-0">
                                  {new Date(act.createdAt).toLocaleString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p className="text-[#555555] leading-relaxed text-[11px] font-medium text-left">{act.details}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-[#999999] italic">No historic digital footprints registered.</p>
                      )}
                    </div>

                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-16 space-y-2 flex-1">
                    <User className="w-12 h-12 text-[#E5E5E3] shrink-0" />
                    <p className="text-xs font-bold text-black uppercase tracking-wider">No User Selected</p>
                    <p className="text-[11px] text-[#999999] max-w-[240px] leading-normal font-medium">
                      Select any registered student on the left directory panel to audit their complete system footprint history.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* RIGHT COLUMN (1/3 width) - LIVE APP NOTIFICATIONS / PLOTS */}
        <div className="space-y-4">
          
          {/* Header */}
          <div className="flex justify-between items-center border-b border-[#E5E5E3] pb-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[#555555] flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-black shrink-0" />
              <span>LIVE SYSTEM ACTIVITY FEED</span>
            </h3>
            {adminActivities && adminActivities.length > 0 && (
              <span className="text-[10px] font-mono font-bold bg-[#111111] text-white px-1.5 py-0.5 rounded-full">
                {filteredActivities.length} logs
              </span>
            )}
          </div>

          {/* ACTIVE FILTER CONTROLS */}
          <div className="bg-white border border-[#E5E5E3] rounded-lg p-3 space-y-2.5 text-left">
            <div className="flex items-center gap-1 text-[11px] font-bold text-[#555555] uppercase tracking-wider pb-1.5 border-b border-neutral-100">
              <Filter className="w-3 h-3 text-neutral-600" />
              <span>Log Controls & Filters</span>
            </div>

            {/* Date Picker */}
            <div className="space-y-1">
              <label className="block text-[9.5px] font-bold text-neutral-400 uppercase tracking-wider">
                Filter by Date
              </label>
              <div className="flex gap-1.5">
                <input
                  type="date"
                  value={activityDate}
                  onChange={(e) => {
                    setActivityDate(e.target.value);
                    setActivityPage(1); // Reset page to first
                  }}
                  className="flex-1 px-2.5 h-8 border border-[#E5E5E3] rounded text-xs font-medium focus:outline-none focus:border-black bg-stone-50"
                />
                {activityDate && (
                  <button
                    onClick={() => {
                      setActivityDate("");
                      setActivityPage(1);
                    }}
                    className="px-2 h-8 border border-neutral-200 hover:bg-neutral-100 rounded text-[10px] font-bold text-neutral-500 uppercase transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Hour Selector dropdown */}
            <div className="space-y-1">
              <label className="block text-[9.5px] font-bold text-neutral-400 uppercase tracking-wider">
                Time of Day
              </label>
              <select
                value={activityTimeRange}
                onChange={(e) => {
                  setActivityTimeRange(e.target.value);
                  setActivityPage(1); // Reset page to first
                }}
                className="w-full px-2.5 h-8 border border-[#E5E5E3] bg-stone-50 rounded text-xs font-medium focus:outline-none focus:border-black transition"
              >
                <option value="all">Any Custom Time Range (All Hours)</option>
                <option value="morning">Morning (06:00 - 12:00)</option>
                <option value="afternoon">Afternoon (12:00 - 18:00)</option>
                <option value="evening">Evening (18:00 - 24:00)</option>
                <option value="night">Night (00:00 - 06:00)</option>
              </select>
            </div>
          </div>

          {/* ACTIVITY FEED DISPLAY */}
          <div className="divide-y divide-[#E5E5E3] space-y-4 max-h-[580px] overflow-y-auto text-left relative min-h-[160px] pr-1" id="recent-activity-feed">
            {activitiesLoading ? (
              <div className="py-12 flex justify-center items-center">
                <LoadingSpinner size="md" label="Reloading digital footprint logs..." />
              </div>
            ) : paginatedActivities.length > 0 ? (
              paginatedActivities.map((act, index) => {
                const initials = act.userName
                  ? act.userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                  : "ST";
                
                return (
                  <div key={act.id || index} className={`flex items-start gap-3 text-left ${index > 0 ? "pt-4" : ""}`}>
                    
                    {/* Initials profile Bubble */}
                    <div className="w-[28px] h-[28px] rounded-full bg-stone-100 border border-neutral-200 flex items-center justify-center text-[10px] font-bold text-neutral-600 shrink-0 uppercase select-none">
                      {initials}
                    </div>
                    
                    {/* Text lines */}
                    <div className="space-y-0.5 flex-1 min-w-0 text-left">
                      <div className="flex justify-between items-start gap-1">
                        <h4 className="text-xs font-bold text-black leading-tight truncate">
                          {act.userName}
                        </h4>
                        <span className="text-[7.5px] font-extrabold uppercase border bg-stone-50 border-stone-200 text-stone-600 rounded px-1.5 py-0.5 leading-none shrink-0 font-mono">
                          {act.action}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#555555] leading-relaxed break-words font-medium">
                        {act.details}
                      </div>
                      <span className="block text-[8.5px] text-[#999999] font-mono pt-0.5">
                        {new Date(act.createdAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}{" "}
                        • {new Date(act.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-14 text-center text-xs text-[#999999] font-mono italic">
                No active operational logs match these filter options.
              </div>
            )}
          </div>

          {/* FLOATING SYSTEM PAGINATION NAVIGATION */}
          {filteredActivities.length > itemsPerPage && !activitiesLoading && (
            <div className="flex items-center justify-between border-t border-[#E5E5E3] pt-4 select-none">
              <button
                type="button"
                disabled={clampedPage === 1}
                onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                className="p-1 px-2 border border-[#E5E5E3] rounded hover:bg-neutral-100 text-xs text-[#555555] font-bold disabled:opacity-40 disabled:hover:bg-transparent transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-none">
                Page {clampedPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={clampedPage === totalPages}
                onClick={() => setActivityPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 px-2 border border-[#E5E5E3] rounded hover:bg-neutral-100 text-xs text-[#555555] font-bold disabled:opacity-40 disabled:hover:bg-transparent transition flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
