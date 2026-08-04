import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Package, ShoppingBag, Trash2, Minus, Plus } from "lucide-react";
import { useCart, useClearCart, usePlaceOrder, useRemoveCartItem, useUpdateCartItem } from "./hooks/useShop";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { useToastStore } from "../../lib/store";

export default function CartPage() {
  const navigate = useNavigate();
  const { data: cart, isLoading } = useCart();
  const removeItem = useRemoveCartItem();
  const updateItem = useUpdateCartItem();
  const clearCart = useClearCart();
  const placeOrder = usePlaceOrder();
  const { addToast } = useToastStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [orderError, setOrderError] = useState<string[]>([]);

  const items = cart?.items || [];
  const subtotal = cart?.total || 0;

  const handleClear = () => {
    clearCart.mutate(undefined, { onSuccess: () => setShowClearConfirm(false) });
  };

  const handlePlaceOrder = () => {
    setOrderError([]);
    placeOrder.mutate(undefined, {
      onSuccess: (result: any) => {
        addToast("Order placed! We'll notify you when it's ready for collection.", "success", 4000);
        navigate(`/app/shop/orders/${result.order_id}`);
      },
      onError: (error: any) => {
        const detail = error?.response?.data?.error?.detail || "Unable to place order";
        if (detail.includes("out of stock") || detail.includes("Some items")) {
          setOrderError([detail]);
        }
      },
    });
  };

  return (
    <div className="min-h-screen bg-white pb-24 text-[#111111]">
      <header className="sticky top-0 z-30 h-14 border-b border-[#E5E5E3] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
          <button type="button" onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E3] bg-white">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-[20px] font-semibold">Cart</h1>
          <div className="w-9" />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-0 pb-24">
        {items.length > 0 ? (
          <>
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-[13px] text-[#555555]">{items.length} item(s)</p>
              <button type="button" onClick={() => setShowClearConfirm((v) => !v)} className="text-[13px] text-[#999999]">Clear all</button>
            </div>
            {showClearConfirm ? <div className="mx-4 mb-2 flex items-center justify-between rounded-[8px] border border-[#E5E5E3] bg-[#F7F7F5] px-3 py-2 text-[13px]"><span className="text-[#E74C3C] font-medium">Remove all items?</span><div className="flex items-center gap-3"><button type="button" onClick={handleClear} className="font-medium text-[#E74C3C]">Yes, clear</button><button type="button" onClick={() => setShowClearConfirm(false)} className="text-[#555555]">Cancel</button></div></div> : null}
            <div className="divide-y divide-[#E5E5E3]">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex h-[56px] w-[56px] items-center justify-center overflow-hidden rounded-[6px] bg-[#F7F7F5]">
                    {item.product.image_urls && item.product.image_urls.length > 0 ? <img src={item.product.image_urls[0]} alt={item.product.name} className="h-full w-full object-cover" /> : <Package className="h-6 w-6 text-[#999999]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[#111111]">{item.product.name}</p>
                    <p className="mt-1 text-[12px] text-[#999999]">MUR {item.product.price} each</p>
                    <p className="mt-1 text-[13px] font-semibold text-[#111111]">MUR {item.product.price * item.quantity}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateItem.mutate({ product_id: item.product.id, quantity: Math.max(1, item.quantity - 1) })} className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-[#E5E5E3] bg-white"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="min-w-[16px] text-center text-[13px] font-semibold">{item.quantity}</span>
                      <button type="button" onClick={() => updateItem.mutate({ product_id: item.product.id, quantity: item.quantity + 1 })} className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-[#E5E5E3] bg-white"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <button type="button" onClick={() => removeItem.mutate(item.product.id)} className="text-[12px] text-[#999999]"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 pt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#999999]">Order summary</p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-[13px] text-[#111111]"><span>Subtotal</span><span>MUR {subtotal}</span></div>
                <div className="flex items-center justify-between text-[13px] text-[#555555]"><span>Delivery</span><span>Free</span></div>
                <p className="text-[11px] italic text-[#999999]">Delivered to campus collection point</p>
                <div className="mt-2 border-t border-[#E5E5E3] pt-3 flex items-center justify-between"><span className="text-[14px] font-medium text-[#111111]">Total</span><span className="text-[16px] font-bold text-[#111111]">MUR {subtotal}</span></div>
              </div>
              <p className="mt-3 text-[12px] italic text-[#999999]">Pay on collection. No online payment required.</p>
              {orderError.length > 0 ? <div className="mt-3 rounded-[8px] border border-[#E5E5E3] bg-[#F7F7F5] p-3 text-[13px] text-[#555555]">{orderError.join(" ")}</div> : null}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EFEFED]">
              <ShoppingBag className="h-8 w-8 text-[#999999]" />
            </div>
            <p className="mt-4 text-[16px] font-medium text-[#555555]">Your cart is empty</p>
            <p className="mt-1 text-[13px] text-[#999999]">Browse the shop to find something you need.</p>
            <button type="button" onClick={() => navigate("/app/shop")} className="mt-4 rounded-[8px] border border-[#111111] px-4 py-2 text-[13px] font-medium text-[#111111]">Browse shop</button>
          </div>
        )}
      </div>

      {items.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#E5E5E3] bg-white">
          <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-center px-4">
            <button type="button" disabled={placeOrder.isPending} onClick={handlePlaceOrder} className="flex h-11 w-full items-center justify-center rounded-[8px] bg-[#111111] text-[14px] font-medium text-white">
              {placeOrder.isPending ? <LoadingSpinner size="sm" /> : `Place order — MUR ${subtotal}`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
