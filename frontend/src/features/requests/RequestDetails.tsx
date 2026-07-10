/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useRequest, useUpdateRequest, useRequests } from "../../hooks/queries";
import { PriorityBadge, StatusBadge } from "../../components/ui/Badge";
import RequestDetailSkeleton from "../../components/ui/RequestDetailSkeleton";
import { useToastStore } from "../../lib/store";
import { CATEGORY_ICONS } from "./StudentHome";
import RepairProgressTracker from "../../components/RepairProgressTracker";
import {
  ArrowLeft,
  Calendar,
  AlertTriangle,
  FileText,
  BadgeAlert,
  MapPin,
  CircleDot,
  CheckCircle,
  HelpCircle,
  Clock,
  ExternalLink,
  X,
  Search,
  Coins,
  Wrench,
  Sparkles,
  ClipboardList,
} from "lucide-react";

// The 7 stages
const STAGES = [
  { value: "submitted", label: "Submitted", desc: "Claim logged", icon: ClipboardList },
  { value: "under_review", label: "Under Review", desc: "Inspection & diagnosis", icon: Search },
  { value: "quote_sent", label: "Quote Sent", desc: "Pricing estimate ready", icon: Coins },
  { value: "confirmed", label: "Confirmed", desc: "Operator authorized", icon: CheckCircle },
  { value: "with_provider", label: "In Repair", desc: "At specialist boutique", icon: Wrench },
  { value: "ready_for_collection", label: "Ready", desc: "Safe to collect", icon: MapPin },
  { value: "completed", label: "Completed", desc: "Job finalized", icon: Sparkles },
];

export default function RequestDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToastStore();
  const optimisticState = location.state as { optimistic?: boolean; requestData?: any } | undefined;
  const isOptimistic = optimisticState?.optimistic === true;

  const { data: request, isLoading, error } = useRequest(isOptimistic ? undefined : (id || ""));
  const { data: allRequests } = useRequests();
  const updateMutation = useUpdateRequest(id || "");

  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelStep, setCancelStep] = useState(1);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineStep, setDeclineStep] = useState(1);
  const [selectedDeclineReason, setSelectedDeclineReason] = useState("");
  const [customDeclineReason, setCustomDeclineReason] = useState("");

  if (isOptimistic && optimisticState?.requestData) {
    return (
      <div className="space-y-6 py-4 animate-slide-up">
        <div className="rounded-2xl border border-[#E5E5E3] bg-[#F7F7F5] p-4 text-left">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#999999]">SUBMITTING REQUEST</p>
              <h2 className="mt-2 text-lg font-semibold text-[#111111]">Your request is being sent</h2>
            </div>
            <span className="rounded-full border border-[#E5E5E3] bg-white px-3 py-1 text-[12px] text-[#555555]">Submitting…</span>
          </div>
          <p className="mt-3 text-sm text-[#555555]">We’re saving your repair request and will update this page as soon as it is confirmed.</p>
        </div>
        <div className="rounded-2xl border border-[#E5E5E3] bg-white p-4 text-left">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#999999]">REQUEST SUMMARY</p>
          <div className="mt-3 space-y-2 text-sm text-[#555555]">
            <p><span className="font-semibold text-[#111111]">Category:</span> {optimisticState.requestData.category}</p>
            <p><span className="font-semibold text-[#111111]">Priority:</span> {optimisticState.requestData.priority}</p>
            <p><span className="font-semibold text-[#111111]">Status:</span> {optimisticState.requestData.status}</p>
            <p><span className="font-semibold text-[#111111]">Description:</span> {optimisticState.requestData.description}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <RequestDetailSkeleton />;
  }

  if (error || !request) {
    return (
      <div className="py-12 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-[#E74C3C] mx-auto" />
        <h3 className="text-lg font-semibold text-[#111111]">Request details could not be loaded</h3>
        <p className="text-sm text-[#555555]">Ensure the URL is correct or try again shortly.</p>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-[#111111] text-white rounded-lg text-sm font-semibold transition hover:bg-[#333333] cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const handleAcceptQuote = () => {
    updateMutation.mutate({ isQuoteAccepted: true });
  };

  const handleDeclineQuote = () => {
    setDeclineStep(1);
    setSelectedDeclineReason("");
    setCustomDeclineReason("");
    setShowDeclineModal(true);
  };

  const handleConfirmDeclineWarning = () => {
    setDeclineStep(2);
  };

  const handleFinalDeclineSubmit = () => {
    const finalReason = selectedDeclineReason === "Other" ? customDeclineReason : selectedDeclineReason;
    if (!finalReason) {
      addToast("Please select a reason or enter your own.", "error");
      return;
    }
    updateMutation.mutate(
      { isQuoteAccepted: false, cancelReason: finalReason },
      {
        onSuccess: () => {
          setShowDeclineModal(false);
          addToast("You have declined the quote. The request has been cancelled.", "success");
        },
      }
    );
  };

  const handlePayDeposit = () => {
    updateMutation.mutate({ depositPaid: true });
    addToast("Deposit payment of 400 MUR simulated successfully! Order with provider now.", "success");
  };

  const handleCancelClick = () => {
    setCancelStep(1);
    setSelectedReason("");
    setCustomReason("");
    setShowCancelModal(true);
  };

  const handleConfirmWarning = () => {
    setCancelStep(2);
  };

  const handleFinalCancelSubmit = () => {
    const finalReason = selectedReason === "Other" ? customReason : selectedReason;
    if (!finalReason) {
      addToast("Please select a reason or enter your own.", "error");
      return;
    }
    updateMutation.mutate(
      { status: "cancelled", cancelReason: finalReason },
      {
        onSuccess: () => {
          setShowCancelModal(false);
          addToast("Your request has being canceled", "success");
        },
      }
    );
  };

  // Fetch active requests to determine current service volume

  // Find index of current status
  const currentStageIndex = STAGES.findIndex((s) => s.value === request.status);
  const isCancelled = request.status === "cancelled";
  const canCancel = !["with_provider", "ready_for_collection", "completed", "cancelled"].includes(request.status);

  // Category Icon
  const IconComponent = CATEGORY_ICONS[request.category] || HelpCircle;

  // Calculate estimated completion based on category, priority and service volume
  const activeRequestsCount = allRequests
    ? allRequests.filter((r) => r.status !== "completed" && r.status !== "cancelled").length
    : 0;

  let baseHours = 48; // default
  let categoryLabel = "Standard Item";
  if (request.category === "phone") {
    baseHours = 48; // 2 days
    categoryLabel = "Phone Repair";
  } else if (request.category === "laptop") {
    baseHours = 72; // 3 days
    categoryLabel = "Laptop Repair";
  } else if (request.category === "clothing") {
    baseHours = 24; // 1 day
    categoryLabel = "Clothing Fix";
  } else if (request.category === "shoe") {
    baseHours = 36; // 1.5 days
    categoryLabel = "Shoe Fix";
  } else if (request.category === "accessories") {
    baseHours = 48; // 2 days
    categoryLabel = "Accessories Repair";
  } else if (request.category === "other") {
    baseHours = 60; // 2.5 days
    categoryLabel = "Custom Repair";
  }

  // Service volume load multipliers
  let volumeMultiplier = 1.0;
  let volumeStatus = "Low Volume (Optimal)";
  let volumeColor = "text-emerald-700 bg-emerald-50/50 border-emerald-200";
  let volumeDesc = "No operator delays - fast resolution is on track.";

  if (activeRequestsCount > 8) {
    volumeMultiplier = 1.6;
    volumeStatus = "Severe Volume (High Queues)";
    volumeColor = "text-rose-700 bg-rose-50/50 border-rose-200";
    volumeDesc = "+60% extra duration delay applied.";
  } else if (activeRequestsCount > 4) {
    volumeMultiplier = 1.25;
    volumeStatus = "Moderate Volume (Elevated Queues)";
    volumeColor = "text-amber-700 bg-amber-50/50 border-amber-200";
    volumeDesc = "+25% latency delay applied.";
  }

  // Priority scale multiplier
  let priorityMultiplier = 1.0;
  let priorityLabel = "Normal workflow speed";
  if (request.priority === "high") {
    priorityMultiplier = 0.75;
    priorityLabel = "Expedited workflow speed (-25%)";
  } else if (request.priority === "low") {
    priorityMultiplier = 1.2;
    priorityLabel = "Standard queue background speed (+20%)";
  }

  const calculatedHours = Math.round(baseHours * volumeMultiplier * priorityMultiplier);
  const createdDate = new Date(request.createdAt);
  const estimatedCompletionDate = new Date(createdDate.getTime() + calculatedHours * 60 * 60 * 1000);

  return (
    <div className="space-y-8 animate-slide-up pb-12">
      {/* HEADER ROW */}
      <div className="flex items-center justify-between border-b border-[#E5E5E3] pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg border border-[#E5E5E3] hover:bg-[#F7F7F5] text-[#555555] cursor-pointer transition"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[#111111] flex items-center gap-2">
              Request <span className="font-mono text-[#555555]">{request.id}</span>
            </h2>
            <p className="text-xs text-[#999999] mt-0.5">
              Submitted on {new Date(request.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canCancel && (
            <button
              onClick={handleCancelClick}
              className="h-8 px-3 border border-[#E5E5E3] hover:bg-[#F7F7F5] text-[#555555] rounded-lg text-xs font-semibold uppercase tracking-wider transition cursor-pointer"
              id="cancel-request-btn"
            >
              Cancel Request
            </button>
          )}
          {isCancelled ? (
            <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] rounded-[4px] border bg-[#F7F7F5] text-[#555555] border-[#E5E5E3]">
              Cancelled
            </span>
          ) : (
            <StatusBadge value={request.status} />
          )}
        </div>
      </div>

      {/* CANCELLATION SUCCESS NOTICE BANNER */}
      {isCancelled && (
        <div className="p-4 bg-[#F7F7F5] border-l-2 border-[#A7A7A7] flex flex-col gap-2 animate-fade-in" id="cancellation-banner">
          <div className="flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-[#555555] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-[#111111] uppercase tracking-wider">This request has been cancelled</h4>
              <p className="text-xs text-[#555555] mt-1">The request is no longer active, but can be restored by admin if needed.</p>
              {request.cancelReason && (
                <p className="text-xs text-[#555555] mt-1">
                  Reason: <span className="font-semibold text-[#111111]">{request.cancelReason}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* COLLECTION NOTICE (CONDITIONAL BANNER FOR READY ITEMS) */}
      {request.status === "ready_for_collection" && (
        <div className="p-4 bg-[#F1F2E9] border-l-2 border-[#111111] flex gap-3 items-start">
          <MapPin className="w-5 h-5 text-black shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-black uppercase tracking-wider">Your item is ready for collection!</h4>
            <p className="text-sm text-[#111111] mt-1 leading-relaxed">
              {request.readyNotes || "Please coordinate collection with our team. Balance is due on pickup (cash or card)."}
            </p>
          </div>
        </div>
      )}

      {/* VISUAL REPAIR PROGRESS TIMELINE */}
      {!isCancelled && (
        <RepairProgressTracker status={request.status} createdAt={request.createdAt} />
      )}

      {/* ESTIMATED COMPLETION SCHEDULE */}
      {!isCancelled && request.status !== "completed" && (
        <section className="space-y-4" aria-label="Delivery Prediction Schedule">
          <h3 className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#555555] border-b border-[#E5E5E3] pb-2" id="completion-schedule-title">
            Estimated Completion Schedule
          </h3>
          <div className="py-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-[#E5E5E3]">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#999999]" id="completion-target-label">Calculated Completion Target</span>
                <div className="text-sm font-semibold text-[#111111] mt-2 block" aria-labelledby="completion-target-label">
                  {estimatedCompletionDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })} at {estimatedCompletionDate.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <p className="text-xs text-[#555555] mt-1.5 leading-normal">
                  Based on a calculated duration of <span className="font-mono font-semibold">{calculatedHours} hours</span> (~{Math.ceil(calculatedHours / 24)} business days) total turnaround from original submission time.
                </p>
              </div>

              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#999999]">Base Category Duration</span>
                <span className="text-sm font-semibold text-[#111111] mt-2 block capitalize">
                  {request.category} Fix ({baseHours} Hours)
                </span>
                <p className="text-xs text-[#555555] mt-1.5 leading-normal">
                  Standard queue processing benchmark for any subcategory under <span className="font-semibold">{categoryLabel}</span>.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#999999]">Campus Operations Latency</span>
                <span className="text-sm font-semibold text-[#111111] mt-1.5 block">
                  {activeRequestsCount} Active Claims ({volumeStatus})
                </span>
                <p className="text-xs text-[#555555] mt-1 leading-normal">
                  {volumeDesc}
                </p>
              </div>

              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#999999]">Speed Priority Level</span>
                <span className="text-sm font-semibold text-[#111111] mt-1.5 block capitalize">
                  {request.priority} Priority
                </span>
                <p className="text-xs text-[#555555] mt-1 leading-normal">
                  {priorityLabel}.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ATTACHED QUOTE BOX (IF QUOTE IS RECEIVED) */}
      {request.status === "quote_sent" && (
        <section className="space-y-4 animate-slide-up pb-6 border-b border-[#E5E5E3]">
          <h3 className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#555555]">Action Required: Review Cost Quote</h3>
          <div className="py-2 space-y-4 text-left">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#E5E5E3] text-left">
                  <th className="pb-2 font-medium text-[#555555]">Description</th>
                  <th className="pb-2 font-medium text-[#555555] text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E3]">
                <tr>
                  <td className="py-2.5 text-[#555555]">{request.category.charAt(0).toUpperCase() + request.category.slice(1)} Repair cost (Port Louis)</td>
                  <td className="py-2.5 text-right font-mono font-medium">{request.providerCost || 0} MUR</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-[#555555]">Transport & Operator handling</td>
                  <td className="py-2.5 text-right font-mono font-medium">{request.serviceCharge || 0} MUR</td>
                </tr>
                <tr className="border-t-2 border-t-[#111111] font-semibold">
                  <td className="py-3 text-[#111111]">Total Repair Quote</td>
                  <td className="py-3 text-right font-mono text-[15px] text-[#111111]">{request.totalCost || 0} MUR</td>
                </tr>
              </tbody>
            </table>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleAcceptQuote}
                disabled={updateMutation.isPending}
                className="flex-1 h-10 bg-[#111111] hover:bg-[#333333] text-white font-medium rounded-lg text-sm transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {updateMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : null}
                <span>{updateMutation.isPending ? "Accepting item repair quote..." : "Accept & Confirm Quote"}</span>
              </button>
              <button
                onClick={handleDeclineQuote}
                disabled={updateMutation.isPending}
                className="flex-1 h-10 bg-white border border-[#E5E5E3] hover:bg-neutral-50 text-black font-semibold rounded-lg text-sm transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {updateMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-black/10 border-t-black rounded-full animate-spin" />
                ) : null}
                <span>{updateMutation.isPending ? "Declining state..." : "Decline & Cancel"}</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* DEPOSIT PAYMENT CARD (SHOWS AFTER ACCEPTANCE) */}
      {(request.status === "confirmed" || (request.isQuoteAccepted && !request.depositPaid)) && (
        <section className="py-5 border-t border-b border-[#E5E5E3] space-y-4 text-left">
          <div>
            <h3 className="text-sm font-semibold text-[#111111]">Deposit Balance Pending</h3>
            <p className="text-xs text-[#555555] mt-0.5">
              A commitment deposit is required so our support team can safely deliver your item to the Port Port Louis mechanic.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#E5E5E3] pt-4">
            <div className="space-y-0.5">
              <span className="text-xs uppercase tracking-wider text-[#555555] font-semibold">Commitment Deposit due</span>
              <p className="text-lg font-mono font-semibold text-[#111111]">400 MUR</p>
            </div>
            <button
              onClick={handlePayDeposit}
              disabled={updateMutation.isPending}
              className="w-full sm:w-auto h-10 px-6 bg-[#111111] hover:bg-[#333333] text-white font-medium rounded-lg text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {updateMutation.isPending && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>{updateMutation.isPending ? "Processing payment..." : "Simulate Deposit Payment"}</span>
            </button>
          </div>
        </section>
      )}

      {/* DEPOSIT PAID STATUS INDICATOR */}
      {request.depositPaid && !request.finalPaid && (
        <div className="p-4 bg-[#F1F2E9] border-l-2 border-[#111111] text-sm text-[#111111] flex items-center justify-between">
          <span className="font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-black" /> Deposit of 400 MUR Paid successfully
          </span>
          <span className="font-mono text-xs text-[#555555]">
            Remaining balance: {request.totalCost ? request.totalCost - 400 : 0} MUR on collection
          </span>
        </div>
      )}

      {/* SYSTEM MESSAGE / OPERATOR COMMENTS */}
      {request.operatorNotes && (
        <section className="space-y-3">
          <h3 className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#555555]">
            Messages from Operator (Cloova Support)
          </h3>
          <div className="py-4 border-t border-b border-[#E5E5E3]">
            <p className="text-sm text-[#111111] leading-relaxed whitespace-pre-line text-left">{request.operatorNotes}</p>
          </div>
        </section>
      )}

      {/* CORE DETAILS */}
      <section className="space-y-4">
        <h3 className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#555555] border-b border-[#E5E5E3] pb-2">
          Request Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2 text-left">
          <div className="space-y-4">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#999999]">Service Category</span>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="w-8 h-8 rounded-lg bg-[#F1F2E9] border border-[#E5E5E3] flex items-center justify-center text-[#111111]">
                  <IconComponent className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-[#111111]">{request.category.charAt(0).toUpperCase() + request.category.slice(1)} Repair</span>
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#999999]">Item Description</span>
              <p className="text-sm text-[#111111] mt-1.5 leading-relaxed whitespace-pre-wrap">{request.description}</p>
            </div>

            {(request.brand || request.model || request.accessoryType || request.issues.length > 0 || request.customIssue) && (
              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#999999]">Guided Request Summary</span>
                <div className="text-sm text-[#555555] mt-1.5 space-y-2">
                  {request.accessoryType && (
                    <p className="leading-relaxed"><span className="font-semibold text-[#111111]">Accessory Type:</span> {request.accessoryType}</p>
                  )}
                  {request.brand && (
                    <p className="leading-relaxed"><span className="font-semibold text-[#111111]">Brand:</span> {request.brand}</p>
                  )}
                  {request.model && (
                    <p className="leading-relaxed"><span className="font-semibold text-[#111111]">Model:</span> {request.model}</p>
                  )}
                  {request.issues.length > 0 && (
                    <p className="leading-relaxed"><span className="font-semibold text-[#111111]">Selected Issues:</span> {request.issues.join(", ")}</p>
                  )}
                  {request.customIssue && (
                    <p className="leading-relaxed"><span className="font-semibold text-[#111111]">Additional Issue:</span> {request.customIssue}</p>
                  )}
                </div>
              </div>
            )}

            {request.additionalNotes && (
              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#999999]">Additional Notes</span>
                <p className="text-sm text-[#555555] mt-1.5 whitespace-pre-wrap">{request.additionalNotes}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#999999]">Priority Level</span>
              <div className="mt-1.5">
                <PriorityBadge value={request.priority} />
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#999999]">Contact Phone</span>
              <p className="text-sm font-mono font-semibold text-[#111111] mt-1.5">{request.studentPhone || "Not specified"}</p>
            </div>

            {/* Photos */}
            {request.photos && request.photos.length > 0 && (
              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#999999]">Uploaded Photos</span>
                <div className="flex gap-2.5 mt-2">
                  {request.photos.map((photo, pIdx) => (
                    <div
                      key={pIdx}
                      onClick={() => setExpandedImage(photo)}
                      className="w-16 h-16 rounded-md border border-[#E5E5E3] overflow-hidden cursor-zoom-in hover:opacity-85 transition"
                    >
                      <img src={photo} alt="Device visual snapshot" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* QUICK LINK TO PUBLIC PROVIDER JOB-CARD OVERVIEW */}
      <section className="py-5 border-t border-[#E5E5E3] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h4 className="text-sm font-semibold text-[#111111]">Shareable Job Ticket</h4>
          <p className="text-xs text-[#555555]">This yields a screenshot-friendly, text-large card to send local mechanics.</p>
        </div>
        <Link
          to={`/job-card/${request.id}`}
          target="_blank"
          className="w-full sm:w-auto h-9 px-4 bg-white border border-[#E5E5E3] text-[#111111] font-semibold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition hover:bg-[#F7F7F5]"
        >
          <span>Open Ticket</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </section>

      {/* EXPANDED PHOTO DIALOG OVERLAY */}
      {expandedImage && (
        <div
          onClick={() => setExpandedImage(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-2xl max-h-[85vh] overflow-hidden rounded-lg">
            <img src={expandedImage} alt="Expanded visual snapshot" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute top-3 right-3 p-1.5 bg-black/70 hover:bg-black/95 text-white rounded-full flex items-center justify-center button-close transition focus:outline-none"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* CANCEL MODAL OVERLAY */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E5E5E3] shadow-xl w-full max-w-md overflow-hidden animate-slide-up">
            <div className="p-5 border-b border-[#E5E5E3] flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#111111]">
                {cancelStep === 1 ? "Are you sure?" : "Reason for Cancelling"}
              </h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="p-1 rounded-lg text-[#999999] hover:text-[#111111] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cancelStep === 1 ? (
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-10 h-10 text-red-600 shrink-0" />
                  <div>
                    <h4 className="text-base font-semibold text-[#111111]">Cancel this repair request?</h4>
                    <p className="text-sm text-[#555555] mt-1 leading-relaxed">
                      Are you sure you want to cancel request <span className="font-mono font-bold">{request.id}</span>? Once cancelled, our team and the partners will stop processing your item.
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex gap-3 justify-end border-t border-[#E5E5E3]">
                  <button
                    onClick={() => setShowCancelModal(false)}
                    className="h-10 px-4 bg-white border border-[#E5E5E3] hover:bg-[#F7F7F5] rounded-lg text-sm font-semibold transition cursor-pointer text-[#555555]"
                  >
                    No, Keep Request
                  </button>
                  <button
                    onClick={handleConfirmWarning}
                    className="h-10 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
                    id="confirm-cancel-warning-btn"
                  >
                    Yes, Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4 custom-scrollbar">
                <p className="text-sm text-[#555555]">
                  Please let us know your reason for cancelling this request:
                </p>

                <div className="space-y-2">
                  {[
                    "The repair quote is too expensive",
                    "I found a cheaper alternative",
                    "I decide to buy a new one instead of repairing",
                    "I don't need this repair anymore",
                    "Other",
                  ].map((option) => (
                    <label
                      key={option}
                      className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E5E3] hover:bg-[#F7F7F5] cursor-pointer transition select-none"
                    >
                      <input
                        type="radio"
                        name="cancelReason"
                        value={option}
                        checked={selectedReason === option}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        className="text-[#111111] focus:ring-[#111111]"
                      />
                      <span className="text-sm text-[#111111] font-medium">{option}</span>
                    </label>
                  ))}
                </div>

                {selectedReason === "Other" && (
                  <div className="space-y-1.5 pt-1 animate-slide-up">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#555555]">
                      Please specify your reason:
                    </label>
                    <textarea
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Type your cancellation reason here..."
                      className="w-full min-h-[80px] p-3 rounded-lg border border-[#E5E5E3] focus:ring-1 focus:ring-[#111111] text-sm text-[#111111] outline-none"
                    />
                  </div>
                )}

                <div className="pt-4 flex gap-3 justify-end border-t border-[#E5E5E3]">
                  <button
                    onClick={() => setCancelStep(1)}
                    className="h-10 px-4 bg-white border border-[#E5E5E3] hover:bg-[#F7F7F5] rounded-lg text-sm font-semibold transition cursor-pointer text-[#555555]"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleFinalCancelSubmit}
                    disabled={updateMutation.isPending || !selectedReason || (selectedReason === "Other" && !customReason.trim())}
                    className="h-10 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    id="submit-cancel-reason-btn"
                  >
                    {updateMutation.isPending ? "Cancelling..." : "Confirm Cancellation"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DECLINE QUOTE MODAL OVERLAY */}
      {showDeclineModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E5E5E3] shadow-xl w-full max-w-md overflow-hidden animate-slide-up">
            <div className="p-5 border-b border-[#E5E5E3] flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#111111]">
                {declineStep === 1 ? "Decline Quote estimate" : "Reason for Declining"}
              </h3>
              <button
                onClick={() => setShowDeclineModal(false)}
                className="p-1 rounded-lg text-[#999999] hover:text-[#111111] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {declineStep === 1 ? (
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-10 h-10 text-red-600 shrink-0" />
                  <div>
                    <h4 className="text-base font-semibold text-[#111111]">Decline this pricing estimate?</h4>
                    <p className="text-sm text-[#555555] mt-1 leading-relaxed">
                      Are you sure you want to decline the quote for request <span className="font-mono font-bold">#{request.id}</span>? Once declined, your repair request will be cancelled, and our support team will return your item unrepaired.
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex gap-3 justify-end border-t border-[#E5E5E3]">
                  <button
                    onClick={() => setShowDeclineModal(false)}
                    className="h-10 px-4 bg-white border border-[#E5E5E3] hover:bg-[#F7F7F5] rounded-lg text-sm font-semibold transition cursor-pointer text-[#555555]"
                  >
                    No, Keep Quote
                  </button>
                  <button
                    onClick={handleConfirmDeclineWarning}
                    className="h-10 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
                    id="confirm-decline-warning-btn"
                  >
                    Yes, Proceed to Decline
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4 custom-scrollbar">
                <p className="text-sm text-[#555555]">
                  Please let us know your reason for declining this repair quote:
                </p>

                <div className="space-y-2">
                  {[
                    "The repair quote is too expensive",
                    "I found a cheaper alternative",
                    "I decide to buy a new one instead of repairing",
                    "I don't need this repair anymore",
                    "Other",
                  ].map((option) => (
                    <label
                      key={option}
                      className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E5E3] hover:bg-[#F7F7F5] cursor-pointer transition select-none"
                    >
                      <input
                        type="radio"
                        name="declineReason"
                        value={option}
                        checked={selectedDeclineReason === option}
                        onChange={(e) => setSelectedDeclineReason(e.target.value)}
                        className="text-[#111111] focus:ring-[#111111]"
                      />
                      <span className="text-sm text-[#111111] font-medium">{option}</span>
                    </label>
                  ))}
                </div>

                {selectedDeclineReason === "Other" && (
                  <div className="space-y-1.5 pt-1 animate-slide-up">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#555555]">
                      Please specify your reason:
                    </label>
                    <textarea
                      value={customDeclineReason}
                      onChange={(e) => setCustomDeclineReason(e.target.value)}
                      placeholder="Type your reason for declining here..."
                      className="w-full min-h-[80px] p-3 rounded-lg border border-[#E5E5E3] focus:ring-1 focus:ring-[#111111] text-sm text-[#111111] outline-none"
                    />
                  </div>
                )}

                <div className="pt-4 flex gap-3 justify-end border-t border-[#E5E5E3]">
                  <button
                    onClick={() => setDeclineStep(1)}
                    className="h-10 px-4 bg-white border border-[#E5E5E3] hover:bg-[#F7F7F5] rounded-lg text-sm font-semibold transition cursor-pointer text-[#555555]"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleFinalDeclineSubmit}
                    disabled={updateMutation.isPending || !selectedDeclineReason || (selectedDeclineReason === "Other" && !customDeclineReason.trim())}
                    className="h-10 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    id="submit-decline-reason-btn"
                  >
                    {updateMutation.isPending ? "Declining..." : "Confirm Decline & Cancel"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
