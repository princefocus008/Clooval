/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useAdminSupportMessages, useMarkSupportMessageRead } from "../../hooks/queries";
import { Inbox, Check, MessageCircle, Mail, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function AdminSupportInbox() {
  const { data: supportMessages, isLoading, error } = useAdminSupportMessages();
  const markReadMutation = useMarkSupportMessageRead();

  const unreadCount = supportMessages?.filter((message) => !message.isRead).length || 0;

  const handleMarkRead = (id: string) => {
    markReadMutation.mutate(id);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">Support Inbox</h1>
          <p className="mt-1 text-[13px] text-[#666666] max-w-[720px]">
            Incoming messages from the website support widget and general help requests.
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
            Failed to load support messages.
          </div>
        ) : supportMessages?.length ? (
          <div className="divide-y divide-[#E5E5E3] rounded-3xl border border-[#E5E5E3] bg-white">
            {supportMessages.map((message) => (
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
            <p className="text-lg font-semibold text-[#111111]">No new support messages.</p>
            <p className="mt-2 text-sm text-[#777777]">All support requests are current.</p>
          </div>
        )}
      </div>
    </div>
  );
}
