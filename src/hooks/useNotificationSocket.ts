"use client";

import { useEffect } from "react";
import { io, Socket } from "socket.io-client";

interface NotificationCreatedPayload {
  id: string;
  title: string;
  content: string;
  type: string;
  createdAt: string;
}

interface NotificationReadPayload {
  notificationId?: string;
  notificationIds?: string[];
  updatedCount?: number;
  unreadCount: number;
}

interface UseNotificationSocketParams {
  accessToken: string;
  onNotification: (payload: NotificationCreatedPayload) => void;
  onNotificationRead?: (payload: NotificationReadPayload) => void;
}

export function useNotificationSocket(params: UseNotificationSocketParams): void {
  useEffect(() => {
    if (!params.accessToken) {
      return;
    }

    const socket: Socket = io({
      path: "/api/socket/io",
      auth: { token: params.accessToken }
    });

    socket.on("notification.created", (payload: NotificationCreatedPayload) => {
      params.onNotification(payload);
    });
    socket.on("notification.read", (payload: NotificationReadPayload) => {
      params.onNotificationRead?.(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [params.accessToken, params.onNotification]);
}
