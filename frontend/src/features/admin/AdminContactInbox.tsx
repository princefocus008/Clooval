/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { KEYS, useAdminContactMessages, useMarkContactMessageRead } from "../../hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { Inbox, Check, MessageCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function AdminContactInbox() {
  const { data: contactMessages, isLoading, error } = useAdminContactMessages();
  const markReadMutation = useMarkContactMessageRead();
  const queryClient = useQueryClient();

  const [showOlder, setShowOlder] = useState(false);
  const [olderPage, setOlderPage] = useState(1);
  const PAGE_SIZE = 10;

  const unreadCount = contactMessages?.filter((message) => !message.isRead).length || 0;
  const unreadMessages = contactMessages?.filter((message) => !message.isRead) || [];
  const olderTotalPages = Math.max(1, Math.ceil((contactMessages?.length || 0) / PAGE_SIZE));
  const olderPageItems = contactMessages?.slice((olderPage - 1) * PAGE_SIZE, olderPage * PAGE_SIZE) || [];

  const handleMarkRead = (id: string) => {
    queryClient.setQueryData(KEYS.contactMessages, (current: any) =>
      current?.map((m: any) => (m.id === id ? { ...m, isRead: true } : m))
    );
    markReadMutation.mutate(id, {
      onError: () => {
        queryClient.invalidateQueries({ queryKey: KEYS.contactMessages });
      },
    });
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">Contact Inbox</h1>
          <p className="mt-1 text-[13px] text-[#666666] max-w-[720px]">
            Incoming messages from the website "Get in Touch" form.
          </p>
        </div>
        <div className="rounded-3xl border border-[#E5E5E3] bg-white px-4 py-2 text-sm font-semibold text-[#111111]">
          <span className="mr-2 inline-flex items-center gap-2 text-[#111111]">
            <Inbox className="h-4 w-4" /> Unread
          </span>
          {unreadCount}
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4 rounded-3xl border border-[#E5E5E3] bg-white p-6">
            {[1, 2, 3].map((item) => (
              <div key={item} className="animate-pulse rounded-2xl bg-[#F8F8F6] p-5" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-[#FFE6E6] bg-[#FFF5F5] p-6 text-[#A11313]">
            <p className="text-sm font-semibold">Failed to load contact messages.</p>
            <p className="mt-2 text-xs text-[#9B1C1C]">
              {import.meta.env.DEV
                ? `Error: ${error?.message || "Unknown error"}`
                : "Please check your connection and try again."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-full bg-[#111111] px-4 py-2 text-[12px] font-semibold text-white"
            >
              Try again
            </button>
          </div>
        ) : unreadMessages.length ? (
          <div className="divide-y divide-[#E5E5E3] rounded-3xl border border-[#E5E5E3] bg-white">
            <div className="flex items-center justify-between p-5">
              <div className="text-sm text-[#666666]">Showing unread messages</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowOlder(true)}
                  className="rounded-full border border-[#E5E5E3] bg-white px-3 py-2 text-[13px] font-semibold text-[#111111] hover:bg-[#F7F7F5]"
                >
                  Older messages
                </button>
              </div>
            </div>
            {unreadMessages.map((message) => (
              <div key={message.id} className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.18em] text-[#999999]">
                      <span>{message.category}</span>
                      {!message.isRead && (
                        <span className="rounded-full bg-[#111111] px-2 py-1 text-[10px] text-white">NEW</span>
                      )}
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-[#111111]">
                      {message.name} · {message.email}
                    </h2>
                    <p className="mt-2 max-w-[720px] text-sm leading-[1.6] text-[#444444] whitespace-pre-line">
                      {message.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-right text-[12px] text-[#777777]">
                    <Clock className="h-4 w-4" />
                    <span>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={message.isRead || markReadMutation.isPending}
                    onClick={() => handleMarkRead(message.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-[#E5E5E3] bg-[#F7F7F5] px-4 py-2 text-[13px] font-semibold text-[#111111] transition hover:bg-[#EFEFEF] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    {message.isRead ? "Marked as read" : "Mark as read"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-[#E5E5E3] bg-white p-8 text-center text-[#555555]">
            <MessageCircle className="mx-auto mb-4 h-8 w-8 text-[#999999]" />
            <p className="text-lg font-semibold text-[#111111]">No new contact messages.</p>
            <p className="mt-2 text-sm text-[#777777]">All messages have been reviewed.</p>
          </div>
        )}
      </div>

      {showOlder && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowOlder(false)} />
          <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-[#E5E5E3] p-4">
              <h3 className="text-lg font-semibold text-[#111111]">Older messages</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowOlder(false)}
                  className="rounded-md border border-transparent bg-[#F7F7F5] px-3 py-1 text-sm font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {olderPageItems?.map((message) => (
                <div key={message.id} className="p-4 border-b last:border-b-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-[#111111]">
                        {message.name} <span className="ml-2 rounded-full border border-[#E5E5E3] px-2 py-0.5 text-[11px] text-[#777777]">{message.category}</span>
                      </div>
                      <div className="text-xs text-[#666666]">
                        {message.email} • {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                      </div>
                      <div className="mt-2 text-sm text-[#444444] whitespace-pre-line">{message.message}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        type="button"
                        disabled={message.isRead || markReadMutation.isPending}
                        onClick={() => handleMarkRead(message.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-[#E5E5E3] bg-[#F7F7F5] px-3 py-1 text-[13px] font-semibold text-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Check className="h-4 w-4" />
                        {message.isRead ? "Marked as read" : "Mark as read"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-[#E5E5E3] p-4">
              <div className="text-sm text-[#666666]">Page {olderPage} of {olderTotalPages}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={olderPage <= 1}
                  onClick={() => setOlderPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border border-[#E5E5E3] bg-white px-3 py-1 text-sm font-semibold disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={olderPage >= olderTotalPages}
                  onClick={() => setOlderPage((p) => Math.min(olderTotalPages, p + 1))}
                  className="rounded-md border border-[#E5E5E3] bg-white px-3 py-1 text-sm font-semibold disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
