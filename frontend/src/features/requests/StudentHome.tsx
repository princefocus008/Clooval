/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRequests } from "../../hooks/queries";
import { useAuthStore } from "../../lib/store";
import { PriorityBadge, StatusBadge } from "../../components/ui/Badge";
import Skeleton from "../../components/ui/Skeleton";
import {
  Smartphone,
  Laptop,
  Shirt,
  Search,
  Hammer,
  Gem,
  HelpCircle,
  Plus,
  Inbox,
  Clock,
  ChevronRight,
  CreditCard,
  Home,
  Zap,
  Scissors
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const CATEGORY_ICONS = {
  phone: Smartphone,
  laptop: Laptop,
  clothing: Shirt,
  shoe: Hammer,
  accessories: Gem,
  other: HelpCircle,
};

export default function StudentHome() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  const { data: requests, isLoading, error, refetch } = useRequests();

  // Active requests are defined as those that are NOT completed or cancelled
  const activeRequests = requests?.filter((r) => r.status !== "completed" && r.status !== "cancelled") || [];
  const activeCount = activeRequests.length;

  // Let's get greeting based on local Mauritius time
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good morning";
    if (hr < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8 animate-slide-up">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#111111]">
            {getGreeting()}, {user?.name.split(" ")[0] || "Amara"}.
          </h2>
          <p className="text-sm text-[#555555] mt-0.5" id="active-requests-cnt">
            {isLoading
              ? "Loading active requests status..."
              : `You have ${activeCount} active request${activeCount === 1 ? "" : "s"}.`}
          </p>
        </div>

        <Link
          to="/app/requests/new/select"
          className="w-full sm:w-auto h-10 px-5 bg-[#111111] hover:bg-[#333333] text-white font-medium rounded-lg text-sm transition flex items-center justify-center gap-2"
          id="new-request-btn"
        >
          <Plus className="w-4 h-4" />
          <span>New Request</span>
        </Link>
      </div>

      {/* SERVICE CATEGORIES SECTION */}
      <section className="space-y-4">
        <h3 className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#555555] border-b border-[#E5E5E3] pb-2">
          Service Categories  Select a Repair
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 pb-6 border-b border-[#E5E5E3]">
          <button
            key="phone"
            onClick={() => navigate("/app/requests/new/phone")}
            className="flex items-center gap-4 py-3 text-left w-full hover:bg-[#FAF9F7] transition cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-lg bg-[#F1F2E9] flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="text-sm font-bold text-black block leading-snug">Phone Repair</span>
              <span className="text-xs text-[#999999] block mt-0.5">Screen · Battery · Keys</span>
            </div>
          </button>

          <button
            key="laptop"
            onClick={() => navigate("/app/requests/new/laptop")}
            className="flex items-center gap-4 py-3 text-left w-full hover:bg-[#FAF9F7] transition cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-lg bg-[#F1F2E9] flex items-center justify-center shrink-0">
              <Laptop className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="text-sm font-bold text-black block leading-snug">Laptop Repair</span>
              <span className="text-xs text-[#999999] block mt-0.5">Screen · Power · System</span>
            </div>
          </button>

          <button
            key="clothing"
            onClick={() => navigate("/app/requests/new/clothing")}
            className="flex items-center gap-4 py-3 text-left w-full hover:bg-[#FAF9F7] transition cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-lg bg-[#F1F2E9] flex items-center justify-center shrink-0">
              <Shirt className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="text-sm font-bold text-black block leading-snug">Clothing Fix</span>
              <span className="text-xs text-[#999999] block mt-0.5">Uniform · Alterations · Stitching</span>
            </div>
          </button>

          <button
            key="shoe"
            onClick={() => navigate("/app/requests/new/shoe")}
            className="flex items-center gap-4 py-3 text-left w-full hover:bg-[#F7F7F5] transition cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-lg bg-[#F1F2E9] flex items-center justify-center shrink-0">
              <Hammer className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="text-sm font-bold text-black block leading-snug">Shoe Repair</span>
              <span className="text-xs text-[#999999] block mt-0.5">Soles · Stitching · Restoration</span>
            </div>
          </button>

          <button
            key="accessories"
            onClick={() => navigate("/app/requests/new/accessories")}
            className="flex items-center gap-4 py-3 text-left w-full hover:bg-[#F7F7F5] transition cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-lg bg-[#F1F2E9] flex items-center justify-center shrink-0">
              <Gem className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="text-sm font-bold text-black block leading-snug">Accessories Fix</span>
              <span className="text-xs text-[#999999] block mt-0.5">Chargers · Backpacks · Accessories</span>
            </div>
          </button>

          <button
            key="other"
            onClick={() => navigate("/app/requests/new/other")}
            className="flex items-center gap-4 py-3 text-left w-full hover:bg-[#F7F7F5] transition cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-lg bg-[#F1F2E9] flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="text-sm font-bold text-black block leading-snug">Other Fix</span>
              <span className="text-xs text-[#999999] block mt-0.5">General repair support queries</span>
            </div>
          </button>
        </div>
      </section>

      {/* RECENT REQUESTS */}
      <section className="space-y-4">
        <h3 className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#555555] border-b border-[#E5E5E3] pb-2">
          Your Recent Requests
        </h3>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <div className="flex gap-4 items-center justify-between pb-4 border-b border-[#E5E5E3]">
              <div className="flex gap-3 items-center">
                <Skeleton width="40px" height="40px" borderRadius="100%" />
                <div className="space-y-2">
                  <Skeleton width="180px" height="15px" />
                  <Skeleton width="120px" height="12px" />
                </div>
              </div>
              <Skeleton width="80px" height="24px" />
            </div>
            <div className="flex gap-4 items-center justify-between pb-4 border-b border-[#E5E5E3]">
              <div className="flex gap-3 items-center">
                <Skeleton width="40px" height="40px" borderRadius="100%" />
                <div className="space-y-2">
                  <Skeleton width="160px" height="15px" />
                  <Skeleton width="100px" height="12px" />
                </div>
              </div>
              <Skeleton width="80px" height="24px" />
            </div>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center justify-between">
            <span className="text-sm">Failed to load request catalog.</span>
            <button
              onClick={() => refetch()}
              className="text-xs underline font-semibold cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : requests && requests.length > 0 ? (
          <div className="divide-y divide-[#E5E5E3]" id="requests-list">
            {requests.slice(0, 3).map((request) => {
              const IconComponent = CATEGORY_ICONS[request.category] || HelpCircle;
              const formattedDate = formatDistanceToNow(new Date(request.createdAt), { addSuffix: true });

              return (
                <div
                  key={request.id}
                  onClick={() => navigate(`/requests/${request.id}`)}
                  className="flex items-center justify-between py-4 group cursor-pointer hover:bg-[#F7F7F5]/50 px-2 rounded-lg transition"
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
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3" id="requests-empty">
            <div className="w-12 h-12 rounded-full bg-[#F7F7F5] border border-[#E5E5E3] flex items-center justify-center text-[#999999]">
              <Inbox className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-[#555555] font-medium">No requests yet.</p>
              <p className="text-xs text-[#999999]">Tap 'New Request' above to get started.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
