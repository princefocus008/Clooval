import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  stock_quantity: number;
  is_featured?: boolean;
  image_urls?: string[];
  specs?: Record<string, string>;
  category?: { id: string; name: string; slug: string };
  created_at?: string;
  updated_at?: string;
};

type ShopListResponse = {
  data: Product[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

type CartResponse = {
  items: Array<{
    id: string;
    quantity: number;
    product: {
      id: string;
      name: string;
      price: number;
      stock_quantity: number;
      image_urls?: string[];
      is_available: boolean;
    };
  }>;
  total: number;
  item_count: number;
};

type OrderSummary = {
  id: string;
  status: string;
  total_amount: number;
  created_at?: string;
  updated_at?: string;
  items?: Array<{
    product_id: string;
    product_name: string;
    product_price: number;
    quantity: number;
    line_total: number;
  }>;
};

const normalizePayload = <T,>(payload: any): T => (payload?.success ? payload.data : payload);

export function useCategories() {
  return useQuery({
    queryKey: ["shop", "categories"],
    queryFn: async () => {
      const { data } = await api.get("/shop/categories");
      return normalizePayload<Category[]>(data);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useProducts(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["shop", "products", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        params.set(key, String(value));
      });
      const { data } = await api.get(`/shop/products${params.toString() ? `?${params.toString()}` : ""}`);
      return normalizePayload<ShopListResponse>(data);
    },
    staleTime: 60 * 1000,
  });
}

export function useProduct(slug?: string) {
  return useQuery({
    queryKey: ["shop", "product", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data } = await api.get(`/shop/products/${slug}`);
      return normalizePayload<Product>(data);
    },
    staleTime: 60 * 1000,
    enabled: Boolean(slug),
  });
}

export function useFeaturedProducts() {
  return useQuery({
    queryKey: ["shop", "featured-products"],
    queryFn: async () => {
      const { data } = await api.get("/shop/products/featured");
      return normalizePayload<Product[]>(data);
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCart() {
  return useQuery({
    queryKey: ["shop", "cart"],
    queryFn: async () => {
      const { data } = await api.get("/shop/cart");
      return normalizePayload<CartResponse>(data);
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

const invalidateShopQueries = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["shop", "cart"] }),
    queryClient.invalidateQueries({ queryKey: ["shop", "products"] }),
    queryClient.invalidateQueries({ queryKey: ["shop", "product"] }),
    queryClient.invalidateQueries({ queryKey: ["shop", "orders"] }),
  ]);
};

export function useAddToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { product_id: string; quantity: number }) => {
      const { data } = await api.post("/shop/cart", payload);
      return normalizePayload<CartResponse>(data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["shop", "cart"] });
      await queryClient.invalidateQueries({ queryKey: ["shop", "products"] });
    },
  });
}

export function useUpdateCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ product_id, quantity }: { product_id: string; quantity: number }) => {
      const { data } = await api.patch(`/shop/cart/${product_id}`, { quantity });
      return normalizePayload<CartResponse>(data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["shop", "cart"] });
      await queryClient.invalidateQueries({ queryKey: ["shop", "products"] });
    },
  });
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (product_id: string) => {
      const { data } = await api.delete(`/shop/cart/${product_id}`);
      return normalizePayload<CartResponse>(data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["shop", "cart"] });
      await queryClient.invalidateQueries({ queryKey: ["shop", "products"] });
    },
  });
}

export function useClearCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete("/shop/cart");
      return normalizePayload<CartResponse>(data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["shop", "cart"] });
      await queryClient.invalidateQueries({ queryKey: ["shop", "products"] });
    },
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload?: { notes?: string }) => {
      const { data } = await api.post("/shop/orders", payload || {});
      return normalizePayload<{ order_id: string; status: string; total_amount: number; items: any[] }>(data);
    },
    onSuccess: async () => {
      await invalidateShopQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["shop", "orders"] });
    },
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ["shop", "orders"],
    queryFn: async () => {
      const { data } = await api.get("/shop/orders");
      return normalizePayload<{ data: OrderSummary[]; total: number; page: number; page_size: number; pages: number }>(data);
    },
    staleTime: 30 * 1000,
  });
}

export function useOrder(id?: string) {
  return useQuery({
    queryKey: ["shop", "order", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get(`/shop/orders/${id}`);
      return normalizePayload<OrderSummary & { items: any[]; order_id?: string }>(data);
    },
    staleTime: 30 * 1000,
    enabled: Boolean(id),
  });
}
