/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useProviders, useCreateProvider, useDeleteProvider } from "../../hooks/queries";
import { Provider, RequestCategory } from "../../types";
import Skeleton from "../../components/ui/Skeleton";
import { Users, Plus, Star, Phone, MessageSquare, Tag, X, UserCheck, Inbox, AlertTriangle } from "lucide-react";

const SUPPORTED_SPECIALTIES: RequestCategory[] = [
  "phone",
  "laptop",
  "clothing",
  "shoe",
  "accessories",
  "other",
];

export default function Providers() {
  const { data: providers, isLoading, error } = useProviders();
  const createMutation = useCreateProvider();
  const deleteMutation = useDeleteProvider();

  // Dialog control state
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(5);
  const [selectedSpecialties, setSelectedSpecialties] = useState<RequestCategory[]>([]);

  const handleToggleSpecialty = (cat: RequestCategory) => {
    setSelectedSpecialties((prev) =>
      prev.includes(cat) ? prev.filter((s) => s !== cat) : [...prev, cat]
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;

    createMutation.mutate(
      {
        name,
        phone,
        specialty: selectedSpecialties,
        notes,
        rating: Number(rating),
      },
      {
        onSuccess: () => {
          // Reset form fields
          setName("");
          setPhone("");
          setNotes("");
          setRating(5);
          setSelectedSpecialties([]);
          setModalOpen(false);
        },
      }
    );
  };

  const renderStars = (count: number) => {
    return Array.from({ length: 5 }).map((_, idx) => (
      <Star
        key={idx}
        className={`w-3.5 h-3.5 shrink-0 inline ${
          idx < count ? "fill-[#111111] text-[#111111]" : "text-[#E5E5E3]"
        }`}
      />
    ));
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-[#E5E5E3] pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#111111]">Repair Providers Directory</h2>
          <p className="text-sm text-[#555555] mt-0.5">Manage local Mauritian services and Port Louis workshops.</p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="h-10 px-4 bg-[#111111] hover:bg-[#333333] text-white font-medium rounded-lg text-sm flex items-center gap-1.5 transition cursor-pointer"
          id="add-provider-btn"
        >
          <Plus className="w-4 h-4" />
          <span>New Provider</span>
        </button>
      </div>

      {/* PROVIDERS VIEW CONTAINER */}
      <section className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div key={n} className="p-6 border border-[#E5E5E3] rounded-lg">
                <Skeleton width="180px" height="18px" />
                <Skeleton width="100%" height="12px" className="mt-3" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-[#FFE6E6] bg-[#FFF5F5] p-6 text-[#A11313]">
            <p className="text-sm font-semibold">Failed to retrieve providers directory catalog.</p>
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
        ) : providers && providers.length > 0 ? (
          <div className="divide-y divide-[#E5E5E3] border-t border-[#E5E5E3] mt-4" id="providers-grid">
            {providers.map((p) => (
              <div
                key={p.id}
                className="py-5 space-y-3 text-left"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-base font-semibold text-[#111111] leading-tight pr-1">
                      {p.name}
                    </h4>
                    <div className="flex items-center gap-1.5 py-0.5">
                      {renderStars(p.rating)}
                      <span className="text-xs font-mono font-medium text-[#555555]">({p.rating}.0)</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-[10px] bg-[#F1F2E9] border border-[#E5E5E3] px-2 py-0.5 rounded font-mono font-semibold text-[#111111] shrink-0">
                      ID: {p.id}
                    </span>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      disabled={deleteMutation.isPending || (p.requestCount ?? 0) > 0}
                      title={
                        p.requestCount && p.requestCount > 0
                          ? `Provider is used by ${p.requestCount} request(s) and cannot be deleted`
                          : "Delete provider"
                      }
                      className={`text-red-600 border rounded px-2 py-0.5 text-[10px] font-bold transition ${
                        deleteMutation.isPending || (p.requestCount ?? 0) > 0
                          ? "bg-red-50 border-red-100 text-red-300 cursor-not-allowed"
                          : "hover:text-white hover:bg-red-600 border-red-200"
                      }`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {p.requestCount && p.requestCount > 0 && (
                  <div className="flex items-center gap-2 text-[10px] text-[#B3261E] font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B3261E]" />
                    This provider is referenced by {p.requestCount} request{p.requestCount > 1 ? "s" : ""}.
                  </div>
                )}
                <div className="space-y-2 text-xs">
                  {/* Phone Line */}
                  <div className="flex items-center gap-2 text-[#555555]">
                    <Phone className="w-4 h-4 shrink-0 text-[#999999]" />
                    <span className="font-mono font-semibold text-[#111111]">{p.phone}</span>
                  </div>

                  {/* Specialty Tags */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Tag className="w-4 h-4 shrink-0 text-[#999999] mr-0.5" />
                    {p.specialty.map((spec) => (
                      <span
                        key={spec}
                        className="text-[10px] font-semibold uppercase bg-[#F1F2E9] text-[#111111] border border-[#E5E5E3] px-1.5 py-0.5 rounded"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>

                  {/* Notes Details */}
                  {p.notes && (
                    <div className="text-xs text-[#555555] leading-relaxed italic mt-1 pb-1">
                      "{p.notes}"
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-[#555555] space-y-2">
            <Inbox className="w-8 h-8 text-[#999999] mx-auto" />
            <p className="text-sm font-medium text-[#111111]">Empty directory list</p>
            <p className="text-xs text-[#999999]">Tap 'New Provider' above to start adding local phone card technicians.</p>
          </div>
        )}
      </section>

      {/* DELETE PROVIDER CONFIRMATION DIALOG */}
      {deleteTarget && (
        <div
          onClick={() => setDeleteTarget(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-lg border border-[#E5E5E3] overflow-hidden flex flex-col cursor-default"
          >
            <div className="bg-[#F9EBE8] text-[#B3261E] p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="text-xs font-semibold uppercase tracking-[0.08em]">Confirm Delete</h3>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-[#B3261E] hover:text-[#7A1F14] rounded transition"
              >
                <X className="w-4 h-4 shrink-0" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm font-semibold text-[#111111]">
                Are you sure you want to delete <span className="text-[#B3261E]">{deleteTarget.name}</span>?
              </p>
              <p className="text-xs text-[#555555] leading-relaxed">
                This action will permanently remove the provider from the directory. If this service is attached to existing repair requests, deletion is not allowed.
              </p>
              {deleteTarget.requestCount && deleteTarget.requestCount > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-[#FDE8E5] border border-[#F4C1B8] p-3 text-[#B3261E] text-[12px]">
                  <AlertTriangle className="w-4 h-4" />
                  This provider is currently referenced by {deleteTarget.requestCount} request{deleteTarget.requestCount > 1 ? "s" : ""}.
                </div>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="h-10 px-4 bg-white border border-[#E5E5E3] text-sm font-semibold rounded-lg hover:bg-[#F7F7F5] transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending || (deleteTarget.requestCount ?? 0) > 0}
                  onClick={() => {
                    if (!deleteTarget) return;
                    deleteMutation.mutate(deleteTarget.id, {
                      onSuccess: () => setDeleteTarget(null),
                    });
                  }}
                  className={`h-10 px-4 text-sm font-semibold rounded-lg transition ${
                    deleteMutation.isPending || (deleteTarget.requestCount ?? 0) > 0
                      ? "bg-red-100 text-red-300 cursor-not-allowed border border-red-100"
                      : "bg-[#B3261E] text-white hover:bg-[#8E1C13]"
                  }`}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete provider"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE PROVIDER OVERLAY DIALOG */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-lg border border-[#E5E5E3] overflow-hidden flex flex-col cursor-default"
          >
            <div className="bg-[#111111] text-white p-4 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.05em]">Add Repair Provider</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-white/70 hover:text-white rounded transition"
              >
                <X className="w-4 h-4 shrink-0" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#555555] mb-1.5">
                  Provider Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vassen Phone Repairs"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#E5E5E3] rounded-lg text-sm transition focus:border-2 focus:border-[#111111] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#555555] mb-1.5">
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +230 5231 9904"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#E5E5E3] rounded-lg text-sm transition focus:border-2 focus:border-[#111111] focus:outline-none"
                />
              </div>

              {/* Specialties Multi Selected rows */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#555555] mb-2">
                  Specialties (Select all fitting sectors)
                </label>
                <div className="flex gap-2 flex-wrap">
                  {SUPPORTED_SPECIALTIES.map((cat) => {
                    const isSelected = selectedSpecialties.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleToggleSpecialty(cat)}
                        className={`text-xs px-3 py-1 rounded-full border transition font-semibold cursor-pointer select-none uppercase tracking-wider ${
                          isSelected
                            ? "bg-[#111111] border-[#111111] text-white"
                            : "bg-white border-[#E5E5E3] text-[#555555] hover:bg-[#F7F7F5]"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#555555] mb-1.5">
                  Rating level (1–5 Stars)
                </label>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full h-10 px-2 bg-white border border-[#E5E5E3] rounded-lg text-sm focus:border-2 focus:border-[#111111] focus:outline-none cursor-pointer"
                >
                  <option value={1}>1 Star</option>
                  <option value={2}>2 Stars</option>
                  <option value={3}>3 Stars</option>
                  <option value={4}>4 Stars</option>
                  <option value={5}>5 Stars (Highly Recommended)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#555555] mb-1.5">
                  Location details or specialties notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Master level laptop micro-solderer based near Port Louis Cathedral."
                  rows={2}
                  className="w-full p-3 bg-white border border-[#E5E5E3] rounded-lg text-sm transition focus:border-2 focus:border-[#111111] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 h-10 bg-[#111111] hover:bg-[#333333] text-white font-medium rounded-lg text-sm transition"
                >
                  {createMutation.isPending ? "Adding..." : "Add Provider"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-10 px-4 bg-white border border-[#E5E5E3] hover:bg-[#F7F7F5] font-semibold text-sm transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
