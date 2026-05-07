import { apiClient, apiClientWithMeta } from "./client";
import type { NotificationListItem, PaginationMeta } from "@/lib/types";

export interface NotificationsListMeta extends PaginationMeta {
  unreadCount: number;
}

export interface NotificationsListResponse {
  data: NotificationListItem[];
  meta: NotificationsListMeta;
}

export const notificationsApi = {
  list: async (params: {
    cursor?: string;
    limit?: number;
  } = {}): Promise<NotificationsListResponse> => {
    const response = await apiClientWithMeta<NotificationListItem[]>(
      "/notifications",
      {
        params: {
          cursor: params.cursor,
          limit: params.limit ?? 50,
        },
      }
    );
    const meta = (response.meta ?? { hasMore: false }) as NotificationsListMeta;
    return {
      data: response.data ?? [],
      meta: {
        cursor: meta.cursor,
        hasMore: meta.hasMore,
        unreadCount: meta.unreadCount ?? 0,
      },
    };
  },

  markRead: (id: string) =>
    apiClient<{ id: string; readAt: string }>(
      `/notifications/${id}/read`,
      { method: "PATCH" }
    ),

  markAllRead: () =>
    apiClient<{ marked: number }>("/notifications/mark-all-read", {
      method: "POST",
    }),
};
