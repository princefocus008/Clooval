import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Package } from "lucide-react";
import { useOrder } from "./hooks/useShop";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: order, isLoading } = useOrder(id);

  const statusMessage = (status?: string) => {
    switch (status) {
      case "pending": return "Your order has been received. We'll confirm it shortly.";
      case "confirmed": return "Your order is confirmed. We're preparing it.";
      case "ready_for_collection": return "Your order is ready. Come collect it at the campus drop point.";
      case "completed": return "Collected. Thanks for shopping with Clooval!";
      case "cancelled": return "This order was cancelled.";
      default: return "Your order is being processed.";
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24 text-[#111111]">
      <header className="sticky top-0 z-30 h-14 border-b border-[#E5E5E3] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
          <button type="button" onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E3] bg-white">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-[16px] font-semibold">Order #{String(order?.id || "").slice(0, 8)}</h1>
          <div className="w-9" />
        </div>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="md" /></div>
      ) : order ? (
        <div className="mx-auto max-w-6xl px-0 pb-24">
          <div className="bg-[#F1F2E9] px-4 py-4">
            <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#111111]">{order.status}</p>
            <p className="mt-1 text-[13px] text-[#555555]">{statusMessage(order.status)}</p>
          </div>
          <div className="px-4 pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#999999]">Items ordered</p>
            <div className="mt-3 divide-y divide-[#E5E5E3]">
              {(order.items || []).map((item: any) => (
                <div key={item.product_id} className="flex items-center gap-3 py-3">
                  <div className="flex h-[56px] w-[56px] items-center justify-center rounded-[6px] bg-[#F7F7F5]">
                    <Package className="h-6 w-6 text-[#999999]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-medium text-[#111111]">{item.product_name}</p>
                    <p className="mt-1 text-[12px] text-[#999999]">{item.quantity} × MUR {item.product_price}</p>
                  </div>
                  <p className="text-[13px] font-semibold text-[#111111]">MUR {item.line_total}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="px-4 pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#999999]">Order info</p>
            <div className="mt-3 space-y-3 text-[13px] text-[#555555]">
              <div className="flex justify-between"><span>Order ID</span><span className="font-medium text-[#111111]">{String(order.id).slice(0, 8)}</span></div>
              <div className="flex justify-between"><span>Placed</span><span className="font-medium text-[#111111]">{new Date(order.created_at || Date.now()).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Payment</span><span className="font-medium text-[#111111]">Cash on collection</span></div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
