import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

const normalizePayload = <T,>(payload: unknown): T => {
  if (payload && typeof payload === "object" && "success" in (payload as Record<string, unknown>) && (payload as Record<string, unknown>).success) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  stock_quantity: number;
  is_available: boolean;
  is_featured: boolean;
  image_urls?: string[];
  specs?: Record<string, string>;
  category?: { id: string; name: string; slug: string };
  created_at?: string;
  updated_at?: string;
};

type AdminProductListResponse = {
  data: AdminProduct[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

type AdminOrder = {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  status: string;
  total_amount: number;
  created_at?: string;
  updated_at?: string;
  items?: Array<{ product_name: string; quantity: number; line_total: number }>;
};

type AdminOrderListResponse = {
  data: AdminOrder[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  display_order?: number;
  is_active?: boolean;
};

export function useAdminShopProducts(filters: Record<string, unknown> = {}) {
  return useQuery<AdminProductListResponse>({
    queryKey: ["admin", "shop", "products", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        params.set(key, String(value));
      });
      const { data } = await api.get(`/admin/shop/products${params.toString() ? `?${params.toString()}` : ""}`);
      return normalizePayload<AdminProductListResponse>(data);
    },
    staleTime: 30 * 1000,
  });
}

export function useAdminShopOrders(filters: Record<string, unknown> = {}) {
  return useQuery<AdminOrderListResponse>({
    queryKey: ["admin", "shop", "orders", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        params.set(key, String(value));
      });
      const { data } = await api.get(`/admin/shop/orders${params.toString() ? `?${params.toString()}` : ""}`);
      return normalizePayload<AdminOrderListResponse>(data);
    },
    staleTime: 30 * 1000,
  });
}

export function useAdminShopCategories() {
  return useQuery<Category[]>({
    queryKey: ["admin", "shop", "categories"],
    queryFn: async () => {
      const { data } = await api.get("/admin/shop/categories");
      return normalizePayload<Category[]>(data);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAdminShopProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post("/admin/shop/products", payload);
      return normalizePayload<AdminProduct>(data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "shop", "products"] });
    },
  });
}

export function useUpdateAdminShopProduct(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.patch(`/admin/shop/products/${id}`, payload);
      return normalizePayload<AdminProduct>(data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "shop", "products"] });
    },
  });
}

export function useUpdateAdminShopProductStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const { data } = await api.patch(`/admin/shop/products/${id}/stock`, payload);
      return normalizePayload<{ id: string; stock_quantity: number; updated_at?: string }>(data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "shop", "products"] });
    },
  });
}

export function useUpdateAdminShopOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const { data } = await api.patch(`/admin/shop/orders/${id}/status`, payload);
      return normalizePayload<{ id: string; status: string; admin_notes?: string | null; updated_at?: string }>(data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "shop", "orders"] });
    },
  });
}

export function useAdminShopUploadImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      const { data } = await api.post("/admin/shop/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return normalizePayload<{ url: string; public_id?: string }>(data);
    },
  });
}
