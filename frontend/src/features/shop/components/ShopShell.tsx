import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShoppingBag, ChevronLeft } from "lucide-react";
import { useCart } from "../hooks/useShop";

type ShopShellProps = {
  title: string;
  children: React.ReactNode;
  backTo?: string;
  rightAction?: React.ReactNode;
  hideCart?: boolean;
};

export default function ShopShell({ title, children, backTo, rightAction, hideCart = false }: ShopShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: cart } = useCart();
  const itemCount = cart?.item_count ?? 0;

  return (
    <div className="min-h-screen bg-white text-[#111111]">
      <header className="sticky top-0 z-30 h-14 border-b border-[#E5E5E3] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {backTo ? (
              <button
                type="button"
                onClick={() => navigate(backTo)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E3] bg-white"
                aria-label="Go back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : null}
            <h1 className="text-[18px] font-semibold text-[#111111]">{title}</h1>
          </div>
          {!hideCart ? (
            <button
              type="button"
              onClick={() => navigate("/app/shop/cart")}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E5E3] bg-white"
              aria-label="Open cart"
            >
              <ShoppingBag className="h-5 w-5" />
              {itemCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#111111] text-[9px] font-semibold text-white">
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              ) : null}
            </button>
          ) : (
            rightAction
          )}
        </div>
      </header>
      <div className="mx-auto max-w-6xl pb-24">{children}</div>
    </div>
  );
}
