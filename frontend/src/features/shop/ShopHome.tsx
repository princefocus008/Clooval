import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ShoppingBag, ChevronRight, Package } from "lucide-react";
import { useCategories, useFeaturedProducts, useCart } from "./hooks/useShop";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function ShopHome() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: featured, isLoading: featuredLoading } = useFeaturedProducts();
  const { data: cart } = useCart();
  const itemCount = cart?.item_count ?? 0;

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories || [];
    return (categories || []).filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
  }, [categories, search]);

  const handleSearch = (value: string) => {
    setSearch(value);
  };

  return (
    <div className="min-h-screen bg-white text-[#111111]">
      <header className="sticky top-0 z-30 h-14 border-b border-[#E5E5E3] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
          <h1 className="text-[20px] font-semibold text-[#111111]">Shop</h1>
          <button type="button" onClick={() => navigate("/app/shop/cart")} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E5E3] bg-white">
            <ShoppingBag className="h-5 w-5" />
            {itemCount > 0 ? <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#111111] text-[9px] font-semibold text-white">{itemCount > 9 ? "9+" : itemCount}</span> : null}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-0 pb-24">
        <div className="px-4 pt-4">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#E5E5E3] bg-[#F7F7F5] px-3 transition focus-within:bg-[#EFEFED]">
            <Search className="h-4 w-4 text-[#999999]" />
            <input value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Search products..." className="w-full bg-transparent text-[13px] text-[#111111] outline-none placeholder:text-[#999999]" />
          </label>
        </div>

        <section className="mt-6 px-0">
          <div className="px-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#999999]">Featured</p>
          </div>
          <div className="mt-3 flex gap-3 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {featuredLoading ? (
              <div className="flex gap-3">
                {[1, 2, 3].map((n) => <div key={n} className="h-[200px] w-[160px] animate-pulse rounded-[10px] border border-[#E5E5E3] bg-[#F7F7F5]" />)}
              </div>
            ) : (featured || []).length > 0 ? (
              (featured || []).map((product) => (
                <button key={product.id} type="button" onClick={() => navigate(`/app/shop/product/${product.slug}`)} className="w-[160px] shrink-0 overflow-hidden rounded-[10px] border border-[#E5E5E3] bg-white text-left">
                  <div className="flex h-[130px] items-center justify-center bg-[#F7F7F5]">
                    {product.image_urls && product.image_urls.length > 0 ? (
                      <img src={product.image_urls[0]} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-6 w-6 text-[#999999]" />
                    )}
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="truncate text-[13px] font-medium text-[#111111]">{product.name}</p>
                    <p className="text-[13px] font-bold text-[#111111]">MUR {product.price}</p>
                    {product.stock_quantity === 0 ? <p className="text-[11px] italic text-[#999999]">Out of stock</p> : null}
                  </div>
                </button>
              ))
            ) : (
              <div className="w-full rounded-[10px] border border-[#E5E5E3] bg-[#F7F7F5] p-4 text-sm text-[#555555]">No featured products yet.</div>
            )}
          </div>
        </section>

        <section className="mt-6 px-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#999999]">Browse by category</p>
          <div className="mt-3">
            {categoriesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((n) => <div key={n} className="h-[52px] animate-pulse rounded-none border-b border-[#E5E5E3]" />)}
              </div>
            ) : filteredCategories.length > 0 ? (
              filteredCategories.map((category) => (
                <button key={category.id} type="button" onClick={() => navigate(`/app/shop/category/${category.slug}`)} className="flex h-[52px] w-full items-center justify-between border-b border-[#E5E5E3] px-0 text-left transition-colors hover:bg-[#F7F7F5]">
                  <span className="text-[14px] font-medium text-[#111111]">{category.name}</span>
                  <ChevronRight className="h-4 w-4 text-[#999999]" />
                </button>
              ))
            ) : (
              <div className="rounded-[10px] border border-[#E5E5E3] bg-[#F7F7F5] p-4 text-sm text-[#555555]">No categories found.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
