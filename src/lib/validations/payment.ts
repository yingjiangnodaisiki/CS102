import { z } from "zod";

export const mockTopupSchema = z.object({
  channel: z.enum(["ALIPAY", "WECHAT"]),
  amount: z.number().positive().max(100000)
});
