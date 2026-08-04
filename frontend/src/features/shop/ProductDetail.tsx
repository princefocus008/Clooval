import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle, ChevronLeft, Minus, Package, Plus, ShoppingBag } from "lucide-react";
import { useProduct, useAddToCart, useCart } from "./hooks/useShop";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProduct(slug);
  const { mutate, isPending } = useAddToCart();
  const { data: cart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [feedback, setFeedback] = useState<"idle" | "added">("idle");

  const cartItem = useMemo(() => cart?.items?.find((item) => item.product.id === product?.id), [cart, product]);

  useEffect(() => {
    if (product) setQuantity(1);
  }, [product]);

  useEffect(() => {
    if (feedback !== "added") return;
    const timer = window.setTimeout(() => setFeedback("idle"), 1500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const handleAddToCart = () => {
    if (!product || product.stock_quantity === 0) return;
    mutate({ product_id: product.id, quantity }, {
      onSuccess: () => {
        setFeedback("added");
      },
    });
  };

  const imageUrls = product?.image_urls || [];

  return (
    <div className="min-h-screen bg-white pb-24 text-[#111111]">
      <div className="relative">
        <button type="button" onClick={() => navigate(-1)} className="absolute left-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E5E3] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="h-[280px] w-full bg-[#F7F7F5] md:h-[360px]">
          {isLoading ? (
            <div className="flex h-full items-center justify-center"><LoadingSpinner size="md" /></div>
          ) : imageUrls.length > 0 ? (
            <img src={imageUrls[imageIndex]} alt={product?.name || "Product"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center"><Package className="h-8 w-8 text-[#999999]" /></div>
          )}
        </div>
        {imageUrls.length > 1 ? (
          <div className="mt-3 flex justify-center gap-2">
            {imageUrls.map((_, index) => (
              <button key={index} type="button" onClick={() => setImageIndex(index)} className={`h-2 w-2 rounded-full ${index === imageIndex ? "bg-[#111111]" : "bg-[#E5E5E3]"}`} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="px-4 pb-24 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[18px] font-semibold leading-[1.3] text-[#111111]">{product?.name || "Product"}</h1>
            <p className="mt-1 text-[12px] uppercase tracking-[0.16em] text-[#999999]">{product?.category?.name || "SHOP"}</p>
          </div>
          <p className="text-[20px] font-bold text-[#111111]">MUR {product?.price ?? 0}</p>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {product && product.stock_quantity > 5 ? <><span className="h-1.5 w-1.5 rounded-full bg-[#111111]" /><span className="text-[13px] text-[#555555]">In stock</span></> : product && product.stock_quantity > 0 ? <><span className="h-1.5 w-1.5 rounded-full bg-[#111111]" /><span className="text-[13px] font-medium text-[#111111]">Only {product.stock_quantity} left in stock</span></> : <span className="text-[13px] italic text-[#999999]">Out of stock</span>}
        </div>

        <div className="mt-4 h-px w-full bg-[#E5E5E3]" />

        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#999999]">Details</p>
          <p className="mt-2 text-[14px] leading-[1.7] text-[#555555]">{product?.description || "No description available."}</p>
        </div>

        {product && product.specs && Object.keys(product.specs).length > 0 ? (
          <div className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#999999]">Specifications</p>
            <div className="mt-3 divide-y divide-[#E5E5E3] border-t border-[#E5E5E3]">
              {Object.entries(product.specs).map(([key, value]) => (
                <div key={key} className="flex h-10 items-center justify-between">
                  <span className="text-[13px] text-[#555555]">{key}</span>
                  <span className="text-[13px] font-medium text-[#111111]">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#E5E5E3] bg-white">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-4 px-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setQuantity((v) => Math.max(1, v - 1))} className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-[#E5E5E3] bg-white">
              <Minus className="h-4 w-4" />
            </button>
            <div className="min-w-[32px] text-center text-[16px] font-semibold text-[#111111]">{quantity}</div>
            <button type="button" onClick={() => setQuantity((v) => Math.min(product?.stock_quantity || 1, v + 1))} className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-[#E5E5E3] bg-white">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button type="button" disabled={isPending || !product || product.stock_quantity === 0} onClick={handleAddToCart} className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-[8px] text-[14px] font-medium ${!product || product.stock_quantity === 0 ? "cursor-not-allowed bg-[#E5E5E3] text-[#999999]" : feedback === "added" ? "bg-white text-[#111111] ring-1 ring-[#111111]" : "bg-[#111111] text-white"}`}>
            {isPending ? <LoadingSpinner size="sm" /> : feedback === "added" ? <><CheckCircle className="h-4 w-4" /><span>Added</span></> : cartItem ? <><ShoppingBag className="h-4 w-4" /><span>Added to cart</span></> : <><ShoppingBag className="h-4 w-4" /><span>Add to cart</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}
