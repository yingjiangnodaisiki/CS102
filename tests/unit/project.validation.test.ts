import { createProjectSchema, updateProjectSchema } from "@/lib/validations/project";

describe("project validation", () => {
  it("should pass create payload", () => {
    const parsed = createProjectSchema.parse({
      title: "企业客服智能体开发",
      description: "需要开发多轮对话客服智能体，并完成管理后台接入。",
      budgetMin: 10000,
      budgetMax: 30000,
      biddingEndsAt: "2026-04-01T00:00:00.000Z",
      tags: ["nlp", "rag"]
    });

    expect(parsed.title).toContain("智能体");
  });

  it("should reject empty update payload", () => {
    const result = updateProjectSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
