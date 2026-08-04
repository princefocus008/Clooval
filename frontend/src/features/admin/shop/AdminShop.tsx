import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Image as ImageIcon,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Tag,
  Truck,
  X,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useToastStore } from "../../../lib/store";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import {
  useAdminShopCategories,
  useAdminShopOrders,
  useAdminShopProducts,
  useAdminShopUploadImage,
  useCreateAdminShopProduct,
  useUpdateAdminShopOrderStatus,
  useUpdateAdminShopProduct,
  useUpdateAdminShopProductStock,
} from "../../../hooks/adminShopQueries";

type ProductFormState = {
  category_id: string;
  name: string;
  description: string;
  price: string;
  stock: string;
  is_available: boolean;
  is_featured: boolean;
  image_urls: string[];
};

const emptyForm = (): ProductFormState => ({
  category_id: "",
  name: "",
  description: "",
  price: "",
  stock: "0",
  is_available: true,
  is_featured: false,
  image_urls: [],
});

export default function AdminShop() {
  const location = useLocation();
  const navigate = useNavigate();
  const { productId, orderId } = useParams();
  const { addToast } = useToastStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [orderFilter, setOrderFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [formState, setFormState] = useState<ProductFormState>(emptyForm());
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [orderStatusDrafts, setOrderStatusDrafts] = useState<Record<string, string>>({});
  const [orderNoteDrafts, setOrderNoteDrafts] = useState<Record<string, string>>({});

  const isProductsRoute = location.pathname.includes("/products");
  const isOrdersRoute = location.pathname.includes("/orders");
  const isProductFormRoute = location.pathname.includes("/products/") && (location.pathname.endsWith("/edit") || location.pathname.endsWith("/new"));
  const isOrderDetailRoute = Boolean(orderId);

  const { data: productsResponse, isLoading: productsLoading, refetch: refetchProducts, error: productsError } = useAdminShopProducts({ page: 1, page_size: 100 });
  const { data: ordersResponse, isLoading: ordersLoading, refetch: refetchOrders, error: ordersError } = useAdminShopOrders({ page: 1, page_size: 100 });
  const { data: categories = [] } = useAdminShopCategories();

  const createProductMutation = useCreateAdminShopProduct();
  const updateProductMutation = useUpdateAdminShopProduct(productId || "");
  const updateStockMutation = useUpdateAdminShopProductStock();
  const updateOrderStatusMutation = useUpdateAdminShopOrderStatus();
  const uploadImageMutation = useAdminShopUploadImage();

  const products = useMemo(() => productsResponse?.data || [], [productsResponse]);
  const orders = useMemo(() => ordersResponse?.data || [], [ordersResponse]);

  const selectedProduct = useMemo(() => {
    if (!productId) return null;
    return products.find((item) => item.id === productId) || null;
  }, [productId, products]);

  const selectedOrder = useMemo(() => orders.find((item) => item.id === orderId) || null, [orderId, orders]);

  useEffect(() => {
    if (selectedProduct) {
      setFormState({
        category_id: selectedProduct.category?.id || "",
        name: selectedProduct.name || "",
        description: selectedProduct.description || "",
        price: String(selectedProduct.price ?? ""),
        stock: String(selectedProduct.stock_quantity ?? 0),
        is_available: Boolean(selectedProduct.is_available),
        is_featured: Boolean(selectedProduct.is_featured),
        image_urls: selectedProduct.image_urls || [],
      });
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (!productId) {
      setFormState(emptyForm());
    }
  }, [productId]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const search = searchQuery.trim().toLowerCase();
      const matchesSearch = !search || [product.name, product.description, product.category?.name].some((value) => value?.toLowerCase().includes(search));
      const matchesAvailability = availabilityFilter === "all" || (availabilityFilter === "available" ? product.is_available : !product.is_available);
      return matchesSearch && matchesAvailability;
    });
  }, [products, searchQuery, availabilityFilter]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus = orderFilter === "all" || order.status === orderFilter;
      const value = orderSearch.trim().toLowerCase();
      const matchesSearch = !value || [order.id, order.student_name, order.student_email].some((item) => item?.toLowerCase().includes(value));
      return matchesStatus && matchesSearch;
    });
  }, [orders, orderFilter, orderSearch]);

  const lowStockProducts = useMemo(() => products.filter((product) => product.stock_quantity <= 5), [products]);
  const pendingOrders = useMemo(() => orders.filter((order) => ["pending", "confirmed"].includes(order.status)), [orders]);
  const readyForCollection = useMemo(() => orders.filter((order) => order.status === "ready_for_collection"), [orders]);

  const handleSaveProduct = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.name.trim()) {
      addToast("Product name is required.", "error");
      return;
    }

    const payload = {
      category_id: formState.category_id || categories[0]?.id,
      name: formState.name,
      description: formState.description,
      price: Number(formState.price),
      stock_quantity: Number(formState.stock) || 0,
      is_available: formState.is_available,
      is_featured: formState.is_featured,
      image_urls: formState.image_urls,
      specs: {},
    };

    if (productId) {
      updateProductMutation.mutate(payload, {
        onSuccess: () => {
          addToast("Product updated.", "success");
          navigate("/admin/shop/products");
        },
        onError: (error: any) => addToast(error?.response?.data?.error || "Unable to update product.", "error"),
      });
      return;
    }

    createProductMutation.mutate(payload, {
      onSuccess: () => {
        addToast("Product created.", "success");
        navigate("/admin/shop/products");
      },
      onError: (error: any) => addToast(error?.response?.data?.error || "Unable to create product.", "error"),
    });
  };

  const handleStockUpdate = (productIdValue: string) => {
    const nextStock = Number(stockDrafts[productIdValue] ?? "0");
    updateStockMutation.mutate(
      { id: productIdValue, payload: { stock_quantity: nextStock, operation: "set" } },
      {
        onSuccess: () => {
          addToast("Stock updated.", "success");
          setStockDrafts((current) => ({ ...current, [productIdValue]: "" }));
          refetchProducts();
        },
        onError: (error: any) => addToast(error?.response?.data?.error || "Unable to update stock.", "error"),
      }
    );
  };

  const handleOrderUpdate = (orderIdValue: string) => {
    const nextStatus = orderStatusDrafts[orderIdValue] || selectedOrder?.status || "pending";
    updateOrderStatusMutation.mutate(
      { id: orderIdValue, payload: { status: nextStatus, admin_notes: orderNoteDrafts[orderIdValue] || undefined } },
      {
        onSuccess: () => {
          addToast("Order status updated.", "success");
          refetchOrders();
        },
        onError: (error: any) => addToast(error?.response?.data?.error || "Unable to update order.", "error"),
      }
    );
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadImageMutation.mutateAsync(file);
      setFormState((current) => ({ ...current, image_urls: [...current.image_urls, result.url] }));
      addToast("Image uploaded.", "success");
    } catch (error: any) {
      addToast(error?.response?.data?.error || "Unable to upload image.", "error");
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[{ label: "Products", value: products.length, icon: Package }, { label: "Low stock", value: lowStockProducts.length, icon: AlertTriangle }, { label: "Pending orders", value: pendingOrders.length, icon: ShoppingBag }, { label: "Ready for collection", value: readyForCollection.length, icon: Truck }].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-3xl border border-[#E5E5E3] bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#999999]">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-[#111111]">{card.value}</p>
                </div>
                <div className="rounded-2xl bg-[#F7F7F5] p-3">
                  <Icon className="h-5 w-5 text-[#111111]" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-[#E5E5E3] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#111111]">Low stock alerts</h2>
              <p className="mt-1 text-sm text-[#666666]">Products that need attention before the next pickup window.</p>
            </div>
            <Link to="/admin/shop/products" className="text-sm font-semibold text-[#111111]">Manage products</Link>
          </div>
          <div className="mt-6 space-y-3">
            {lowStockProducts.length ? lowStockProducts.slice(0, 5).map((product) => (
              <div key={product.id} className="flex items-center justify-between rounded-2xl border border-[#E5E5E3] bg-[#F7F7F5] px-4 py-3">
                <div>
                  <p className="font-semibold text-[#111111]">{product.name}</p>
                  <p className="text-sm text-[#666666]">{product.category?.name || "Uncategorized"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#111111]">{product.stock_quantity} in stock</p>
                  <p className="text-xs text-[#999999]">{product.price.toFixed(2)} each</p>
                </div>
              </div>
            )) : <p className="rounded-2xl border border-dashed border-[#E5E5E3] p-4 text-sm text-[#666666]">Everything looks stocked up right now.</p>}
          </div>
        </div>

        <div className="rounded-3xl border border-[#E5E5E3] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#111111]">Recent orders</h2>
              <p className="mt-1 text-sm text-[#666666]">Live status updates from students.</p>
            </div>
            <Link to="/admin/shop/orders" className="text-sm font-semibold text-[#111111]">View all</Link>
          </div>
          <div className="mt-6 space-y-3">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-2xl border border-[#E5E5E3] px-4 py-3">
                <div>
                  <p className="font-semibold text-[#111111]">{order.student_name}</p>
                  <p className="text-sm text-[#666666]">{formatDistanceToNow(new Date(order.created_at || new Date()), { addSuffix: true })}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#111111]">{order.total_amount.toFixed(2)}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#999999]">{order.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#111111]">Products</h2>
          <p className="mt-1 text-sm text-[#666666]">Create, update, and replenish products from the campus shop.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/shop/products/new" className="inline-flex items-center gap-2 rounded-full border border-[#111111] bg-[#111111] px-4 py-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> New product
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-[#E5E5E3] bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full rounded-full border border-[#E5E5E3] bg-[#F9F9F7] py-2.5 pl-9 pr-3 text-sm outline-none" placeholder="Search by product or category" />
          </div>
          <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)} className="rounded-full border border-[#E5E5E3] bg-[#F9F9F7] px-3 py-2.5 text-sm outline-none">
            <option value="all">All availability</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>
      </div>

      {productsLoading ? (
        <div className="rounded-3xl border border-[#E5E5E3] bg-white p-6">
          <LoadingSpinner size="md" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[#E5E5E3] bg-white">
          <div className="grid grid-cols-[1.4fr_0.8fr_0.6fr_0.6fr_0.3fr] gap-3 border-b border-[#E5E5E3] bg-[#F9F9F7] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#999999]">
            <div>Product</div>
            <div>Category</div>
            <div>Price</div>
            <div>Stock</div>
            <div>Action</div>
          </div>
          {filteredProducts.map((product) => (
            <div key={product.id} className="grid grid-cols-[1.4fr_0.8fr_0.6fr_0.6fr_0.3fr] gap-3 border-b border-[#F0F0EC] px-4 py-4 last:border-b-0">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[#111111]">{product.name}</p>
                  {!product.is_available && <span className="rounded-full bg-[#F7F7F5] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[#999999]">Offline</span>}
                </div>
                <p className="mt-1 text-sm text-[#666666] line-clamp-2">{product.description || "No description yet."}</p>
              </div>
              <div className="text-sm text-[#666666]">{product.category?.name || "Uncategorized"}</div>
              <div className="text-sm font-semibold text-[#111111]">{product.price.toFixed(2)}</div>
              <div>
                <p className="text-sm font-semibold text-[#111111]">{product.stock_quantity}</p>
                <div className="mt-2 flex items-center gap-2">
                  <input value={stockDrafts[product.id] ?? ""} onChange={(event) => setStockDrafts((current) => ({ ...current, [product.id]: event.target.value }))} className="w-16 rounded-full border border-[#E5E5E3] px-2 py-1 text-sm" placeholder="Set" />
                  <button onClick={() => handleStockUpdate(product.id)} className="rounded-full border border-[#E5E5E3] px-2 py-1 text-xs font-semibold text-[#111111]">Save</button>
                </div>
              </div>
              <div>
                <Link to={`/admin/shop/products/${product.id}/edit`} className="inline-flex items-center gap-2 rounded-full border border-[#E5E5E3] px-3 py-2 text-sm font-semibold text-[#111111]">
                  <Pencil className="h-4 w-4" /> Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderProductForm = () => {
    const submitLabel = productId ? "Save changes" : "Create product";
    return (
      <div className="space-y-6">
        <button onClick={() => navigate("/admin/shop/products")} className="inline-flex items-center gap-2 text-sm font-semibold text-[#111111]">
          <ArrowLeft className="h-4 w-4" /> Back to products
        </button>

        <div className="rounded-3xl border border-[#E5E5E3] bg-white p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#111111]">{productId ? "Edit product" : "Add product"}</h2>
              <p className="mt-1 text-sm text-[#666666]">Keep the catalogue fresh with prices, stock, images, and featured status.</p>
            </div>
            <div className="rounded-full border border-[#E5E5E3] bg-[#F7F7F5] px-3 py-2 text-sm font-semibold text-[#111111]">
              {productId ? "Editing existing item" : "New shop item"}
            </div>
          </div>

          <form onSubmit={handleSaveProduct} className="mt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-[#111111]">Name</label>
                  <input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#E5E5E3] px-4 py-3 text-sm outline-none" placeholder="Campus essentials" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-[#111111]">Description</label>
                  <textarea value={formState.description} onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))} className="mt-2 min-h-32 w-full rounded-2xl border border-[#E5E5E3] px-4 py-3 text-sm outline-none" placeholder="Short description for students" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-[#111111]">Price</label>
                    <input type="number" min="0" step="0.01" value={formState.price} onChange={(event) => setFormState((current) => ({ ...current, price: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#E5E5E3] px-4 py-3 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#111111]">Stock</label>
                    <input type="number" min="0" step="1" value={formState.stock} onChange={(event) => setFormState((current) => ({ ...current, stock: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#E5E5E3] px-4 py-3 text-sm outline-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-[#111111]">Category</label>
                  <select value={formState.category_id} onChange={(event) => setFormState((current) => ({ ...current, category_id: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#E5E5E3] px-4 py-3 text-sm outline-none">
                    <option value="">Select a category</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center justify-between rounded-2xl border border-[#E5E5E3] px-4 py-3 text-sm font-semibold text-[#111111]">
                    <span>Available</span>
                    <input type="checkbox" checked={formState.is_available} onChange={(event) => setFormState((current) => ({ ...current, is_available: event.target.checked }))} />
                  </label>
                  <label className="flex items-center justify-between rounded-2xl border border-[#E5E5E3] px-4 py-3 text-sm font-semibold text-[#111111]">
                    <span>Featured</span>
                    <input type="checkbox" checked={formState.is_featured} onChange={(event) => setFormState((current) => ({ ...current, is_featured: event.target.checked }))} />
                  </label>
                </div>

                <div className="rounded-2xl border border-[#E5E5E3] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#111111]">Product images</p>
                      <p className="mt-1 text-sm text-[#666666]">Upload one image at a time and add it to the product.</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E5E5E3] px-3 py-2 text-sm font-semibold text-[#111111]">
                      <ImageIcon className="h-4 w-4" /> Upload
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {formState.image_urls.length ? formState.image_urls.map((imageUrl, index) => (
                      <div key={`${imageUrl}-${index}`} className="rounded-2xl border border-[#E5E5E3] px-3 py-2 text-xs text-[#666666]">
                        {imageUrl}
                      </div>
                    )) : <p className="text-sm text-[#666666]">No images yet.</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={createProductMutation.isPending || updateProductMutation.isPending || uploadImageMutation.isPending} className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {createProductMutation.isPending || updateProductMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {submitLabel}
              </button>
              <button type="button" onClick={() => navigate("/admin/shop/products")} className="rounded-full border border-[#E5E5E3] px-4 py-2.5 text-sm font-semibold text-[#111111]">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderOrders = () => (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#111111]">Orders</h2>
          <p className="mt-1 text-sm text-[#666666]">Track status changes and support student pickups.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-[#E5E5E3] bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
            <input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} className="w-full rounded-full border border-[#E5E5E3] bg-[#F9F9F7] py-2.5 pl-9 pr-3 text-sm outline-none" placeholder="Search order, student, or email" />
          </div>
          <select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)} className="rounded-full border border-[#E5E5E3] bg-[#F9F9F7] px-3 py-2.5 text-sm outline-none">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="ready_for_collection">Ready for collection</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {ordersLoading ? (
        <div className="rounded-3xl border border-[#E5E5E3] bg-white p-6"><LoadingSpinner size="md" /></div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div key={order.id} className="rounded-3xl border border-[#E5E5E3] bg-white p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#999999]">{order.id}</p>
                    <span className="rounded-full border border-[#E5E5E3] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[#666666]">{order.status}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-[#111111]">{order.student_name}</h3>
                  <p className="mt-1 text-sm text-[#666666]">{order.student_email}</p>
                  <p className="mt-2 text-sm text-[#666666]">Placed {formatDistanceToNow(new Date(order.created_at || new Date()), { addSuffix: true })}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-[#111111]">{order.total_amount.toFixed(2)}</p>
                  <p className="text-sm text-[#666666]">{order.items?.length || 0} item(s)</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex-1">
                  <label className="text-sm font-semibold text-[#111111]">Status</label>
                  <select value={orderStatusDrafts[order.id] || order.status} onChange={(event) => setOrderStatusDrafts((current) => ({ ...current, [order.id]: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#E5E5E3] px-3 py-2 text-sm outline-none lg:max-w-[220px]">
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="ready_for_collection">Ready for collection</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-semibold text-[#111111]">Admin notes</label>
                  <input value={orderNoteDrafts[order.id] ?? ""} onChange={(event) => setOrderNoteDrafts((current) => ({ ...current, [order.id]: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#E5E5E3] px-3 py-2 text-sm outline-none" placeholder="Optional update" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOrderUpdate(order.id)} className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2 text-sm font-semibold text-white">
                    <Check className="h-4 w-4" /> Update
                  </button>
                  <Link to={`/admin/shop/orders/${order.id}`} className="inline-flex items-center gap-2 rounded-full border border-[#E5E5E3] px-4 py-2 text-sm font-semibold text-[#111111]">
                    View details <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderOrderDetail = () => {
    if (!selectedOrder) {
      return <div className="rounded-3xl border border-[#E5E5E3] bg-white p-6 text-sm text-[#666666]">Order not found.</div>;
    }

    return (
      <div className="space-y-6">
        <button onClick={() => navigate("/admin/shop/orders")} className="inline-flex items-center gap-2 text-sm font-semibold text-[#111111]">
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </button>

        <div className="rounded-3xl border border-[#E5E5E3] bg-white p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#999999]">{selectedOrder.id}</p>
              <h2 className="mt-2 text-xl font-semibold text-[#111111]">{selectedOrder.student_name}</h2>
              <p className="mt-1 text-sm text-[#666666]">{selectedOrder.student_email}</p>
            </div>
            <div className="rounded-full border border-[#E5E5E3] bg-[#F7F7F5] px-3 py-2 text-sm font-semibold text-[#111111]">{selectedOrder.status}</div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#E5E5E3] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#999999]">Placed</p>
              <p className="mt-2 text-sm font-semibold text-[#111111]">{format(new Date(selectedOrder.created_at || new Date()), "PPpp")}</p>
            </div>
            <div className="rounded-2xl border border-[#E5E5E3] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#999999]">Total</p>
              <p className="mt-2 text-sm font-semibold text-[#111111]">{selectedOrder.total_amount.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl border border-[#E5E5E3] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#999999]">Items</p>
              <p className="mt-2 text-sm font-semibold text-[#111111]">{selectedOrder.items?.length || 0}</p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-[#E5E5E3]">
            <div className="grid grid-cols-[1.4fr_0.6fr_0.4fr] gap-3 border-b border-[#E5E5E3] bg-[#F9F9F7] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#999999]">
              <div>Item</div>
              <div>Quantity</div>
              <div>Line total</div>
            </div>
            {(selectedOrder.items || []).map((item, index) => (
              <div key={`${item.product_name}-${index}`} className="grid grid-cols-[1.4fr_0.6fr_0.4fr] gap-3 border-b border-[#F0F0EC] px-4 py-3 last:border-b-0">
                <div className="font-semibold text-[#111111]">{item.product_name}</div>
                <div className="text-sm text-[#666666]">{item.quantity}</div>
                <div className="text-sm font-semibold text-[#111111]">{item.line_total.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">Shop management</h1>
          <p className="mt-1 text-[13px] text-[#666666] max-w-[720px]">Monitor the campus shop, manage stock, and keep orders moving smoothly.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#E5E5E3] bg-white px-4 py-2 text-sm font-semibold text-[#111111]">
          <PackageCheck className="h-4 w-4" /> Admin console
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[#E5E5E3]">
        {[
          { key: "overview", label: "Overview", path: "/admin/shop" },
          { key: "products", label: "Products", path: "/admin/shop/products" },
          { key: "orders", label: "Orders", path: "/admin/shop/orders" },
        ].map((item) => {
          const isActive = (item.key === "overview" && !isProductsRoute && !isOrdersRoute) || (item.key === "products" && isProductsRoute && !isProductFormRoute) || (item.key === "orders" && isOrdersRoute && !isOrderDetailRoute);
          return (
            <Link key={item.key} to={item.path} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${isActive ? "bg-[#111111] text-white" : "bg-white text-[#666666] border border-[#E5E5E3]"}`}>
              {item.label}
            </Link>
          );
        })}
      </div>

      {productsError || ordersError ? (
        <div className="rounded-3xl border border-[#FFE6E6] bg-[#FFF5F5] p-6 text-[#A11313]">
          <p className="text-sm font-semibold">Failed to load shop data.</p>
          <p className="mt-2 text-xs text-[#9B1C1C]">
            {import.meta.env.DEV
              ? `Error: ${productsError?.message || ordersError?.message || "Unknown error"}`
              : "Please check your connection and try again."}
          </p>
          <button
            type="button"
            onClick={() => {
              refetchProducts();
              refetchOrders();
            }}
            className="mt-4 rounded-full bg-[#111111] px-4 py-2 text-[12px] font-semibold text-white"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {!isProductsRoute && !isOrdersRoute && !isProductFormRoute && !isOrderDetailRoute && renderOverview()}
          {isProductsRoute && !isProductFormRoute && renderProducts()}
          {isProductFormRoute && renderProductForm()}
          {isOrdersRoute && !isOrderDetailRoute && renderOrders()}
          {isOrderDetailRoute && renderOrderDetail()}
        </>
      )}
    </div>
  );
}
