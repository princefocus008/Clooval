/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRequests } from "../../hooks/queries";
import { PriorityBadge, StatusBadge } from "../../components/ui/Badge";
import Skeleton from "../../components/ui/Skeleton";
import { CATEGORY_ICONS } from "./StudentHome";
import { HelpCircle, Clock, ChevronRight, Inbox, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type FilterPreset = "all" | "active" | "completed" | "cancelled";

export default function MyRequests() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterPreset>("all");

  const { data: requests, isLoading, error, refetch, isRefetching } = useRequests();

  // Filter local listings
  const sortedRequests = requests ? [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];
  const filteredRequests = sortedRequests.filter((r) => {
    if (filter === "all") return true;
    if (filter === "active") {
      return r.status !== "completed" && r.status !== "cancelled";
    }
    if (filter === "completed") {
      return r.status === "completed";
    }
    if (filter === "cancelled") {
      return r.status === "cancelled";
    }
    return true;
  });

  const presets: { value: FilterPreset; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#111111]">My Requests</h2>
          <p className="text-sm text-[#555555] mt-1">Your most recent submissions appear first.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/app/requests/new/select")}
            className="px-4 py-2 bg-[#111111] text-white text-sm font-semibold rounded-lg hover:bg-[#333333] transition"
          >
            New Request
          </button>
          <button
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="p-2 rounded-lg border border-[#E5E5E3] hover:bg-[#F7F7F5] text-[#555555] cursor-pointer transition disabled:opacity-40"
            aria-label="Refresh requests catalog"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* FILTER ROW PILLS */}
      <div className="flex gap-2 overflow-x-auto pb-1 select-none" role="tablist" aria-label="Filters">
        {presets.map((preset) => {
          const isActive = filter === preset.value;
          return (
            <button
              key={preset.value}
              onClick={() => setFilter(preset.value)}
              role="tab"
              aria-selected={isActive}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border cursor-pointer shrink-0 transition ${
                isActive
                  ? "bg-[#111111] border-[#111111] text-white"
                  : "bg-white border-[#E5E5E3] text-[#555555] hover:bg-[#F7F7F5] hover:text-[#111111]"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* LIST SECTION */}
      <section className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex gap-4 items-center justify-between pb-4 border-b border-[#E5E5E3]">
                <div className="flex gap-3 items-center">
                  <Skeleton width="40px" height="40px" borderRadius="100%" />
                  <div className="space-y-2">
                    <Skeleton width="180px" height="15px" />
                    <Skeleton width="120px" height="12px" />
                  </div>
                </div>
                <Skeleton width="80px" height="24px" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center justify-between">
            <span className="text-sm">Failed to load request list.</span>
            <button
              onClick={() => refetch()}
              className="text-xs underline font-semibold cursor-pointer text-red-600"
            >
              Try again
            </button>
          </div>
        ) : filteredRequests.length > 0 ? (
          <div className="divide-y divide-[#E5E5E3]" id="my-requests-list">
            {filteredRequests.map((request) => {
              const IconComponent = CATEGORY_ICONS[request.category] || HelpCircle;
              const formattedDate = formatDistanceToNow(new Date(request.createdAt), { addSuffix: true });

              return (
                <div
                  key={request.id}
                  onClick={() => navigate(`/app/requests/${request.id}`)}
                  className="flex items-center justify-between py-3 group cursor-pointer hover:bg-[#F7F7F5]/50 px-2 rounded-lg transition"
                >
                  <div className="flex items-start gap-4 pr-4">
                    <div className="w-10 h-10 rounded-lg bg-[#F7F7F5] border border-[#E5E5E3] flex items-center justify-center text-[#111111] shrink-0">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <PriorityBadge value={request.priority} />
                        <span className="text-[11px] font-mono text-[#999999]">{request.id}</span>
                      </div>
                      <h4 className="text-[15px] font-medium text-[#111111] leading-tight group-hover:text-[#333333] line-clamp-1">
                        {request.description}
                      </h4>
                      <p className="text-xs text-[#999999] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {formattedDate}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge value={request.status} />
                    <ChevronRight className="w-4 h-4 text-[#999999] group-hover:text-[#111111] transition" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3" id="requests-empty">
            <Inbox className="w-6 h-6 text-[#999999]" />
            <div>
              <p className="text-[14px] text-[#111111] font-medium">No requests matching filter</p>
              <p className="text-[12px] text-[#999999] mt-1">Change presets above or log a new claim</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
