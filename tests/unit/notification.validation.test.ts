import { listNotificationSchema } from "@/lib/validations/notification";
import { batchReadNotificationSchema } from "@/lib/validations/notification";

describe("notification validation", () => {
  it("should parse pagination query", () => {
    const parsed = listNotificationSchema.parse({
      page: "2",
      pageSize: "10"
    });
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(10);
  });

  it("should reject page below 1", () => {
    const result = listNotificationSchema.safeParse({
      page: "0",
      pageSize: "10"
    });
    expect(result.success).toBe(false);
  });

  it("should parse batch read ids", () => {
    const parsed = batchReadNotificationSchema.parse({
      notificationIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222"
      ]
    });
    expect(parsed.notificationIds).toHaveLength(2);
  });
});
