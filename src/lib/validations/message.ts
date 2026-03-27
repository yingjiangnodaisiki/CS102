import { z } from "zod";

export const listProjectMessageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});

export const sendProjectMessageSchema = z.object({
  receiverId: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
  messageType: z.string().trim().min(1).max(32).optional()
});

export const sendFlexibleMessageSchema = z.object({
  projectId: z.string().uuid().optional(),
  receiverId: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
  messageType: z.string().trim().min(1).max(32).optional()
});
