/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../lib/store";
import { useNotifications, useMarkNotificationsRead, useMarkNotificationRead } from "../../hooks/queries";
import RequestListSkeleton from "../../components/ui/RequestListSkeleton";
import { Bell, Inbox, CheckCheck, ChevronDown, ChevronUp, ArrowUpRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: notifications, isLoading, error } = useNotifications();
  const readAllMutation = useMarkNotificationsRead();
  const markSingleReadMutation = useMarkNotificationRead();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleMarkAllRead = () => {
    readAllMutation.mutate();
  };

  const handleNotificationClick = (id: string, isRead: boolean) => {
    // Toggle expanded state
    setExpandedId(prev => (prev === id ? null : id));
    
    // Mark as read if not already read
    if (!isRead) {
      markSingleReadMutation.mutate(id);
    }
  };

  // Previously the list auto-marked all notifications as read when loaded.
  // That behavior was removed so items remain unread until the user opens them.

  const hasUnread = notifications?.some((n) => !n.isRead) || false;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* HEADER ROW */}
      <div className="flex items-center justify-between border-b border-[#E5E5E3] pb-4">
        <h2 className="text-xl font-semibold tracking-tight text-[#111111]">Notifications</h2>

        {hasUnread && (
          <button
            onClick={handleMarkAllRead}
            disabled={readAllMutation.isPending}
            className="text-xs font-semibold uppercase tracking-wider text-[#111111] hover:text-[#555555] flex items-center gap-1 cursor-pointer transition disabled:opacity-40"
          >
            <CheckCheck className="w-4 h-4 shrink-0" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* NOTIFICATIONS CONTAINER */}
      <section className="space-y-3">
        {isLoading ? (
          <div className="space-y-4 pt-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="py-4 border-b border-[#E5E5E3] space-y-2">
                <Skeleton width="140px" height="15px" />
                <Skeleton width="100%" height="12px" />
                <Skeleton width="80px" height="10px" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
            Failed to fetch notifications. Kindly reload.
          </div>
        ) : notifications && notifications.length > 0 ? (
          <div className="divide-y divide-[#E5E5E3] border-t border-[#E5E5E3]" id="notifications-list">
            {notifications.map((notif) => {
              const formattedDate = formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true });
              const isExpanded = expandedId === notif.id;

              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif.id, notif.isRead)}
                  className={`py-4 transition duration-200 flex flex-col gap-3 cursor-pointer select-none leading-relaxed px-2 ${
                    !notif.isRead
                      ? "bg-[#F1F2E9] text-[#111111] font-medium"
                      : "bg-transparent text-[#555555] hover:bg-[#F7F7F5]"
                  }`}
                >
                  <div className="flex items-start gap-3.5 w-full">
                    {/* Bell indicator */}
                    <div className={`p-1.5 rounded-full shrink-0 mt-0.5 ${
                      !notif.isRead ? "bg-[#111111]/10 text-[#111111]" : "bg-[#F7F7F5] text-[#999999]"
                    }`}>
                      <Bell className="w-4 h-4 shrink-0" />
                    </div>

                    {/* Text header body info */}
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`text-[15px] leading-snug truncate ${
                          !notif.isRead ? "font-semibold text-[#111111]" : "font-medium text-[#555555]"
                        }`}>
                          {notif.title}
                        </h4>
                        
                        {/* Toggle expansion chevron indicators */}
                        <div className="text-gray-400 hover:text-black shrink-0">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                      
                      {/* Truncated line if collapsed, full body if expanded */}
                      <p className={`text-sm leading-relaxed ${isExpanded ? "block" : "line-clamp-1"}`}>
                        {notif.body}
                      </p>

                      <span className="block text-[11px] text-[#999999] pt-1">{formattedDate}</span>
                    </div>
                  </div>

                  {/* Expanded Content View: Buttons and Quotas amounts */}
                  {isExpanded && (
                    <div className="pl-[38px] pt-1 pb-1 space-y-4 animate-slide-up border-t border-dashed border-[#E5E5E3] mt-2">
                      {/* Full message block */}
                      <div className="text-sm cursor-text text-[#333333] selection:bg-neutral-200 leading-relaxed pt-2">
                        <span className="font-semibold text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Detailed Message</span>
                        {notif.body}
                      </div>

                      {/* Display attached amount */}
                      {notif.amount !== undefined && notif.amount !== null && (
                        <div className="text-xs font-semibold text-[#111111]" aria-label={`Amount: MUR ${notif.amount}`}>
                          <span className="text-gray-400 font-medium">Quote Amount: </span>
                          <span className="font-mono bg-neutral-100 border border-neutral-200 px-2.5 py-1 rounded font-bold text-black select-all">
                            MUR {notif.amount}
                          </span>
                        </div>
                      )}

                      {/* View exact request linked button */}
                      {notif.requestId && (
                        <div className="pt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Avoid re-triggering expansion toggle
                              const route = user?.role === "admin" 
                                ? `/admin/requests/${notif.requestId}` 
                                : `/requests/${notif.requestId}`;
                              navigate(route);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#111111] hover:bg-[#333333] rounded-lg transition-all duration-150 cursor-pointer shadow-sm shadow-black/5"
                          >
                            <span>View Linked Request</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3" id="notifications-empty">
            <div className="w-12 h-12 rounded-full bg-[#F7F7F5] border border-[#E5E5E3] flex items-center justify-center text-[#999999]">
              <Inbox className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-[#555555] font-medium">Clear inbox</p>
              <p className="text-xs text-[#999999]">You don't have any notifications right now.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
