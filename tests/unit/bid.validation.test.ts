import { createBidSchema, updateBidSchema } from "@/lib/validations/bid";

describe("bid validation", () => {
  it("should pass create payload", () => {
    const parsed = createBidSchema.parse({
      amount: 5000,
      proposal: "我有多个企业级项目经验，可在4周内完成核心交付和上线。",
      expectedDays: 28,
      attachments: [
        {
          fileName: "proposal.pdf",
          fileUrl: "https://example.com/proposal.pdf",
          fileSize: 1024,
          mimeType: "application/pdf"
        }
      ]
    });

    expect(parsed.expectedDays).toBe(28);
  });

  it("should reject empty update payload", () => {
    const result = updateBidSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
