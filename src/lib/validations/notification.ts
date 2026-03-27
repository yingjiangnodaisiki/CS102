import { z } from "zod";

export const listNotificationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});

export const batchReadNotificationSchema = z.object({
  notificationIds: z.array(z.string().uuid()).min(1).max(100)
});
