/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useRequests } from "../hooks/queries";
import { PriorityBadge, StatusBadge } from "./ui/Badge";
import { 
  Smartphone, 
  Laptop, 
  Shirt, 
  Hammer, 
  Gem, 
  HelpCircle, 
  Search, 
  X, 
  Clock,
  ArrowRight,
  Inbox
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const CATEGORY_ICONS = {
  phone: Smartphone,
  laptop: Laptop,
  clothing: Shirt,
  shoe: Hammer,
  accessories: Gem,
  other: HelpCircle,
};

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: requests, isLoading } = useRequests();

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut: press '/' to focus search bar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if user is already typing in an input/textarea
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.getAttribute("contenteditable") === "true")) {
        return;
      }
      
      if (e.key === "/" || (e.metaKey && e.key === "k") || (e.ctrlKey && e.key === "k")) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter criteria matching: ID, description, category, status, or priority
  const trimmedQuery = query.toLowerCase().trim();
  const filteredRequests = trimmedQuery
    ? requests?.filter((req) => {
        return (
          req.id.toLowerCase().includes(trimmedQuery) ||
          req.description.toLowerCase().includes(trimmedQuery) ||
          req.category.toLowerCase().includes(trimmedQuery) ||
          req.status.toLowerCase().replace("_", " ").includes(trimmedQuery) ||
          req.priority.toLowerCase().includes(trimmedQuery)
        );
      }) || []
    : [];

  const handleSelectRequest = (id: string) => {
    navigate(`/app/requests/${id}`);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* SEARCH INPUT BAR */}
      <div className="relative">
        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-[#999999]">
          <Search className="w-4 h-4" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search past requests by keyword or ID..."
          className="w-full h-10 pl-10 pr-12 bg-[#F7F7F5] focus:bg-white border border-[#E5E5E3] focus:border-[#111111] focus:ring-1 focus:ring-[#111111] rounded-xl text-xs font-medium placeholder-gray-400 transition-all outline-none"
        />
        
        {/* CLEAR BUTTON OR SHORTCUT KEY PILL */}
        <div className="absolute inset-y-0 right-3 flex items-center gap-1.5">
          {query ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full text-gray-400 hover:text-black hover:bg-gray-150 transition"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center justify-center p-1 px-1.5 text-[10px] font-mono text-gray-400 bg-white border border-[#E5E5E3] rounded shadow-sm select-none leading-none pointer-events-none uppercase">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* FLOATING RESULTS DROPDOWN */}
      {isOpen && query.trim() !== "" && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-[#E5E5E3] rounded-xl shadow-xl overflow-hidden max-h-[380px] flex flex-col">
          {/* Header Info */}
          <div className="px-4 py-2 bg-[#F7F7F5] border-b border-[#E5E5E3] flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
            <span>Search results</span>
            <span>{filteredRequests.length} check found</span>
          </div>

          <div className="overflow-y-auto divide-y divide-[#E5E5E3] flex-1">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-[#999999] font-medium flex flex-col items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-[#111111]/20 border-t-[#111111] rounded-full animate-spin" />
                Searching records...
              </div>
            ) : filteredRequests.length > 0 ? (
              filteredRequests.map((req) => {
                const IconComponent = CATEGORY_ICONS[req.category] || HelpCircle;
                const timeStr = formatDistanceToNow(new Date(req.createdAt), { addSuffix: true });
                
                return (
                  <button
                    key={req.id}
                    onClick={() => handleSelectRequest(req.id)}
                    className="w-full text-left px-4 py-3 hover:bg-[#F7F7F5]/60 transition flex items-start gap-3 group border-0 focus:outline-none"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#F7F7F5] border border-[#E5E5E3] text-[#111111] flex items-center justify-center shrink-0 group-hover:bg-[#111111] group-hover:text-white transition">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold text-[#111111] bg-gray-100 px-1.5 py-0.5 rounded">
                          {req.id}
                        </span>
                        <PriorityBadge value={req.priority} className="scale-90 origin-left" />
                      </div>
                      
                      <p className="text-xs font-semibold text-gray-800 line-clamp-1 group-hover:text-black">
                        {req.description}
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        <span className="capitalize">{req.category} claim</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {timeStr}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <StatusBadge value={req.status} className="scale-90 origin-right !px-1.5 !py-0.2" />
                      <div className="text-[10px] text-gray-400 group-hover:text-black font-semibold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition duration-200">
                        View <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center space-y-2 select-none">
                <div className="w-9 h-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400">
                  <Inbox className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#111111]">No repairs matched</p>
                  <p className="text-[11px] text-gray-400 max-w-[200px] mx-auto mt-0.5">
                    We couldn't find any request matching "{query}". Try a different term or ID.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
