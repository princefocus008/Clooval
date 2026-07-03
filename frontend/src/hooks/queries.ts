/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useQuery, useMutation, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Request, Provider, Notification, SupportMessage, ContactMessage } from "../types";
import { useToastStore, useAppStore, useAuthStore } from "../lib/store";
import { saveLocalRequest, saveLocalRequests, saveLocalNotification, saveLocalNotifications, getLocalNotifications } from "../lib/sync";

// Query keys
export const KEYS = {
  requests: ["requests"] as const,
  request: (id: string) => ["requests", id] as const,
  providers: ["providers"] as const,
  notifications: ["notifications"] as const,
  supportMessages: ["admin-support"] as const,
  contactMessages: ["admin-contact"] as const,
};

// Hook: Get all requests (User specific based on auth header)
export function useRequests() {
  return useQuery<Request[], Error, Request[]>({
    queryKey: KEYS.requests,
    queryFn: async () => {
      const res = await api.get("/requests");
      if (res.data && Array.isArray(res.data)) {
        saveLocalRequests(res.data);
      }
      return res.data;
    },
    staleTime: 10000,
    refetchInterval: 3000, // Keep admin and student dashboards fresh without slowing page transitions
    refetchOnWindowFocus: true,
  });
}

// Hook: Get single request details (Public to anyone for job-card sharing, too!)
export function useRequest(id: string | undefined) {
  return useQuery<Request, Error, Request>({
    queryKey: id ? KEYS.request(id) : ["request-placeholder"],
    queryFn: async () => {
      if (!id) throw new Error("Request ID is required");
      const res = await api.get(`/requests/${id}`);
      if (res.data) {
        saveLocalRequest(res.data);
      }
      return res.data;
    },
    enabled: !!id,
    staleTime: 10000,
  });
}

// Hook: Create Request
export function useCreateRequest() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  return useMutation<Request, Error, Partial<Request>>({
    mutationFn: async (payload) => {
      const res = await api.post("/requests", payload);
      return res.data;
    },
    onSuccess: (newReq) => {
      saveLocalRequest(newReq);
      queryClient.invalidateQueries({ queryKey: KEYS.requests });
      addToast(`Your repair request #${newReq.id} has been submitted!`, "success");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || "Failed to submit request";
      addToast(msg, "error");
    },
  });
}

// Hook: Update Request (Admin actions or Student actions like Accept Quote)
export function useUpdateRequest(id: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  return useMutation<Request, Error, Partial<Request>>({
    mutationFn: async (payload) => {
      if (!id) {
        throw new Error("Request ID is required to update a request.");
      }
      const res = await api.patch(`/requests/${id}`, payload);
      return res.data;
    },
    onSuccess: (updated) => {
      saveLocalRequest(updated);
      queryClient.invalidateQueries({ queryKey: KEYS.requests });
      queryClient.invalidateQueries({ queryKey: KEYS.request(id) });
      queryClient.invalidateQueries({ queryKey: KEYS.notifications });
      addToast(`Request #${id} was updated successfully!`, "success");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || "Failed to update request";
      addToast(msg, "error");
    },
  });
}

// Hook: Delete Request (Admin only)
export function useDeleteRequest() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const res = await api.delete(`/requests/${id}`);
      return res.data;
    },
    onSuccess: (_res, id) => {
      queryClient.invalidateQueries({ queryKey: KEYS.requests });
      queryClient.removeQueries({ queryKey: KEYS.request(id) });
      addToast(`Request ${id} deleted permanently.`, "success");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || "Failed to delete request";
      addToast(msg, "error");
    },
  });
}

// Hook: Get Providers (Admin only)
export function useProviders() {
  return useQuery<Provider[], Error, Provider[]>({
    queryKey: KEYS.providers,
    queryFn: async () => {
      const res = await api.get("/providers");
      return res.data;
    },
    staleTime: 60000,
  });
}

// Hook: Add Provider (Admin only)
export function useCreateProvider() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  return useMutation<Provider, Error, Partial<Provider>>({
    mutationFn: async (payload) => {
      const res = await api.post("/providers", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.providers });
      addToast("New repair provider added successfully!", "success");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || "Failed to add provider";
      addToast(msg, "error");
    },
  });
}

// Hook: Delete provider (Admin only)
export function useDeleteProvider() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/providers/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.providers });
      addToast("Provider deleted successfully.", "success");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || "Failed to delete provider";
      addToast(msg, "error");
    },
  });
}

// Hook: Get notifications with auto polling
export function useNotifications(): UseQueryResult<Notification[], Error> {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<Notification[], Error, Notification[], typeof KEYS.notifications>({
    queryKey: KEYS.notifications,
    queryFn: async (): Promise<Notification[]> => {
      const res = await api.get("/notifications");
      if (res.data && Array.isArray(res.data)) {
        saveLocalNotifications(res.data);
      }
      return res.data;
    },
    enabled: isAuthenticated,
    refetchInterval: 2500, // Poll more frequently for faster admin/student notification sync
    staleTime: 2000,
    refetchOnWindowFocus: true,
  });
}

// Hook: Read all notifications
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  const { setUnreadCount } = useAppStore();
  const { addToast } = useToastStore();

  return useMutation<{ success: boolean }, Error, void>({
    mutationFn: async () => {
      const res = await api.post("/notifications/read-all");
      return res.data;
    },
    onSuccess: () => {
      setUnreadCount(0);
      queryClient.setQueryData<Notification[] | undefined>(KEYS.notifications, (current) =>
        current?.map((notif) => ({ ...notif, isRead: true }))
      );
      queryClient.invalidateQueries({ queryKey: KEYS.notifications });
      
      // Update local storage to reflect read-all
      const localNotifs = getLocalNotifications();
      const updated = localNotifs.map((n: any) => ({ ...n, isRead: true }));
      localStorage.setItem("cl_custom_notifications", JSON.stringify(updated));
    },
  });
}

// Hook: Read a single notification
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { setUnreadCount } = useAppStore();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id: string) => {
      const res = await api.post(`/notifications/${id}/read`);
      return res.data;
    },
    onSuccess: (res, id) => {
      queryClient.setQueryData<Notification[] | undefined>(KEYS.notifications, (current) => {
        const updated = current?.map((notif) =>
          notif.id === id ? { ...notif, isRead: true } : notif
        );

        if (updated) {
          setUnreadCount(updated.filter((notif) => !notif.isRead).length);
        }

        return updated;
      });

      const localNotifs = getLocalNotifications();
      const idx = localNotifs.findIndex((n: any) => n.id === id);
      if (idx !== -1) {
        localNotifs[idx].isRead = true;
        localStorage.setItem("cl_custom_notifications", JSON.stringify(localNotifs));
      }
    },
  });
}

// Hook: Get support messages (Admin only)
export function useAdminSupportMessages() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { setUnreadCount } = useAppStore();
  return useQuery<SupportMessage[], Error>({
    queryKey: KEYS.supportMessages,
    queryFn: async () => {
      const res = await api.get("/admin/support");
      // update global app unread count for sidebar badges
      if (res.data && Array.isArray(res.data)) {
        const unread = res.data.filter((m: any) => !m.isRead).length;
        setUnreadCount(unread);
      }
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: 2000,
    refetchInterval: 5000,
  });
}

// Hook: Mark support message read (Admin only)
export function useMarkSupportMessageRead() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id: string) => {
      const res = await api.post(`/admin/support/${id}/read`);
      return res.data;
    },
    onSuccess: (_res, id) => {
      queryClient.setQueryData<SupportMessage[] | undefined>(KEYS.supportMessages, (current) =>
        current?.map((message) =>
          message.id === id ? { ...message, isRead: true } : message
        )
      );
      queryClient.invalidateQueries({ queryKey: KEYS.supportMessages });
    },
  });
}

// Hook: Get Contact Messages (Admin Only)
export function useAdminContactMessages() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<ContactMessage[], Error>({
    queryKey: KEYS.contactMessages,
    queryFn: async () => {
      const res = await api.get("/admin/contact");
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: 2000,
    refetchInterval: 5000,
  });
}

// Hook: Mark contact message read (Admin only)
export function useMarkContactMessageRead() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id: string) => {
      const res = await api.post(`/admin/contact/${id}/read`);
      return res.data;
    },
    onSuccess: (_res, id) => {
      queryClient.setQueryData<ContactMessage[] | undefined>(KEYS.contactMessages, (current) =>
        current?.map((message) =>
          message.id === id ? { ...message, isRead: true } : message
        )
      );
      queryClient.invalidateQueries({ queryKey: KEYS.contactMessages });
    },
  });
}

// Hook: Get all users with their associated requests and activities (Admin only)
export function useAdminUsers() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<any[]>({
    queryKey: ["admin-users"] as const,
    queryFn: async () => {
      const res = await api.get("/admin/users");
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: 2000,
    refetchInterval: 4000, // Keep admin user management dashboard in sync
  });
}

// Hook: Get all activity logs in the app (Admin only)
export function useAdminActivities() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<any[]>({
    queryKey: ["admin-activities"] as const,
    queryFn: async () => {
      const res = await api.get("/admin/activities");
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: 2000,
    refetchInterval: 4000, // Real-time notification feed polls every 4 seconds
  });
}

// Hook: Admin update user details
export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation<any, Error, { id: string; name?: string; email?: string; phone?: string; resident?: string; studentId?: string }>({
    mutationFn: async ({ id, ...payload }) => {
      const res = await api.patch(`/admin/users/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activities"] });
    },
  });
}

// Hook: Admin send custom push alert/notification to a user
export function useSendCustomAlert() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; notification: any }, Error, { id: string; title: string; message: string }>({
    mutationFn: async ({ id, title, message }) => {
      const res = await api.post(`/admin/users/${id}/alert`, { title, message });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-activities"] });
    },
  });
}

// Hook: Subscribe to push notifications
export function usePushSubscribe() {
  const { addToast } = useToastStore();
  
  return useMutation<{ success: boolean }, Error, PushSubscriptionJSON>({
    mutationFn: async (subscription: PushSubscriptionJSON) => {
      const res = await api.post("/push/subscribe", { subscription });
      return res.data;
    },
    onSuccess: () => {
      addToast("Push notifications enabled!", "success");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || "Failed to enable push notifications";
      console.error(msg);
    },
  });
}

// Hook: Unsubscribe from push notifications
export function usePushUnsubscribe() {
  const { addToast } = useToastStore();
  
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (endpoint: string) => {
      const res = await api.post("/push/unsubscribe", { endpoint });
      return res.data;
    },
    onSuccess: () => {
      addToast("Push notifications disabled.", "info");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || "Failed to disable push notifications";
      console.error(msg);
    },
  });
}

// Hook: Get VAPID public key for push subscription
export function useVapidKey() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<{ vapidPublicKey: string }, Error>({
    queryKey: ["vapid-key"] as const,
    queryFn: async () => {
      const res = await api.get("/push/vapid-key");
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: Infinity, // VAPID key doesn't change
  });
}
