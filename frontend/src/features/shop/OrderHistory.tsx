import React from "react";
import { useNavigate } from "react-router-dom";
import { Package } from "lucide-react";
import { useOrders } from "./hooks/useShop";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function OrderHistory() {
  const navigate = useNavigate();
  const { data, isLoading } = useOrders();
  const orders = data?.data || [];

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return "PENDING";
      case "confirmed": return "CONFIRMED";
      case "ready_for_collection": return "READY";
      case "completed": return "COLLECTED";
      case "cancelled": return "CANCELLED";
      default: return status.toUpperCase();
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24 text-[#111111]">
      <header className="sticky top-0 z-30 h-14 border-b border-[#E5E5E3] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
          <h1 className="text-[20px] font-semibold">My Orders</h1>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-0 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="md" /></div>
        ) : orders.length > 0 ? (
          <div className="divide-y divide-[#E5E5E3]">
            {orders.map((order: any) => (
              <button key={order.id} type="button" onClick={() => navigate(`/app/shop/orders/${order.id}`)} className={`w-full border-l-2 px-4 py-4 text-left ${order.status === "ready_for_collection" ? "bg-[#F1F2E9]" : "bg-white"}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[14px] font-medium text-[#111111]">Order #{String(order.id).slice(0, 8)}</p>
                  <p className="text-[12px] text-[#999999]">{new Date(order.created_at || Date.now()).toLocaleDateString()}</p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[13px] text-[#555555]">{order.items?.length || 0} item(s)</p>
                  <div className="flex items-center gap-3">
                    <span className="rounded-[4px] border border-[#E5E5E3] bg-[#F1F2E9] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#111111]">{statusBadge(order.status)}</span>
                    <p className="text-[13px] font-semibold text-[#111111]">MUR {order.total_amount}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EFEFED]">
              <Package className="h-8 w-8 text-[#999999]" />
            </div>
            <p className="mt-4 text-[16px] font-medium text-[#555555]">No orders yet.</p>
            <p className="mt-1 text-[13px] text-[#999999]">Items you order will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
