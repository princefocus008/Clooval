import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, Package } from "lucide-react";
import { useProducts, useCategories } from "./hooks/useShop";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function CategoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [sort, setSort] = useState("newest");
  const [showSort, setShowSort] = useState(false);
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<any[]>([]);
  const { data: categories } = useCategories();
  const category = categories?.find((c) => c.slug === slug);
  const { data, isLoading } = useProducts({ category: slug === "all" ? undefined : slug, page, page_size: 8, sort });

  const allProducts = useMemo(() => {
    if (!data?.data) return [];
    if (page === 1) return data.data;
    return [...products, ...data.data];
  }, [data, page, products]);

  React.useEffect(() => {
    if (page === 1 && data?.data) {
      setProducts(data.data);
    }
  }, [data, page]);

  const totalProducts = data?.total || 0;
  const hasMore = (page * 8) < totalProducts;

  return (
    <div className="min-h-screen bg-white text-[#111111]">
      <header className="sticky top-0 z-30 h-14 border-b border-[#E5E5E3] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
          <button type="button" onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E3] bg-white">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-[16px] font-semibold text-[#111111]">{category?.name || "Shop"}</h1>
          <button type="button" onClick={() => navigate("/app/shop/cart")} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E3] bg-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.3a1 1 0 0 0 1-.8L17 7H7"/><circle cx="10" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/></svg>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl pb-24">
        <div className="flex h-11 items-center justify-between border-b border-[#E5E5E3] px-4">
          <p className="text-[13px] text-[#999999]">{totalProducts} products</p>
          <button type="button" onClick={() => setShowSort((v) => !v)} className="flex items-center gap-1 text-[13px] text-[#555555]">
            <span>Sort</span>
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        {showSort ? <div className="border-b border-[#E5E5E3] bg-[#F7F7F5] px-4 py-3 text-sm text-[#111111]">
          <button type="button" onClick={() => { setSort("newest"); setShowSort(false); setPage(1); }} className="block py-2">Newest</button>
          <button type="button" onClick={() => { setSort("price_asc"); setShowSort(false); setPage(1); }} className="block py-2">Price: low to high</button>
          <button type="button" onClick={() => { setSort("price_desc"); setShowSort(false); setPage(1); }} className="block py-2">Price: high to low</button>
        </div> : null}

        {isLoading && page === 1 ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="md" /></div>
        ) : allProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EFEFED]">
              <Package className="h-8 w-8 text-[#999999]" />
            </div>
            <p className="mt-4 text-[14px] font-medium text-[#555555]">No products here yet.</p>
            <p className="mt-1 text-[13px] text-[#999999]">Check back soon.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 px-4 py-4 md:grid-cols-3 lg:grid-cols-4">
              {allProducts.map((product) => (
                <button key={product.id} type="button" onClick={() => navigate(`/app/shop/product/${product.slug}`)} className="overflow-hidden rounded-[8px] border border-[#E5E5E3] bg-white text-left">
                  <div className="flex h-[140px] items-center justify-center bg-[#F7F7F5]">
                    {product.image_urls && product.image_urls.length > 0 ? <img src={product.image_urls[0]} alt={product.name} className="h-full w-full object-cover" /> : <Package className="h-6 w-6 text-[#999999]" />}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-[13px] font-medium leading-[1.4] text-[#111111]">{product.name}</p>
                    <p className="mt-2 text-[14px] font-bold text-[#111111]">MUR {product.price}</p>
                    {product.stock_quantity === 0 ? <p className="mt-1 text-[11px] italic text-[#999999]">Out of stock</p> : product.stock_quantity < 5 ? <p className="mt-1 text-[11px] text-[#555555]">Only {product.stock_quantity} left</p> : null}
                  </div>
                </button>
              ))}
            </div>
            {hasMore ? (
              <div className="px-4 pb-6">
                <button type="button" onClick={() => setPage((p) => p + 1)} className="flex h-10 w-full items-center justify-center rounded-[8px] border border-[#E5E5E3] bg-white text-[13px] font-medium text-[#111111]">Load more</button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
