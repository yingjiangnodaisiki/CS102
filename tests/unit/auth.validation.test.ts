import { loginSchema, registerSchema } from "@/lib/validations/auth";

describe("auth validation", () => {
  it("should pass register payload", () => {
    const parsed = registerSchema.parse({
      email: " Demo@Example.com ",
      password: "Password123!",
      role: "CLIENT",
      profile: {
        companyName: "示例科技",
        contactName: "张三"
      }
    });

    expect(parsed.email).toBe("demo@example.com");
    expect(parsed.role).toBe("CLIENT");
  });

  it("should reject short password", () => {
    const result = loginSchema.safeParse({
      email: "demo@example.com",
      password: "123"
    });

    expect(result.success).toBe(false);
  });

  it("should reject invalid domain email", () => {
    const result = registerSchema.safeParse({
      email: "demo@invalid",
      password: "Password123!",
      role: "DEVELOPER",
      profile: {
        displayName: "dev"
      }
    });

    expect(result.success).toBe(false);
  });

  it("should reject short numeric qq email", () => {
    const result = registerSchema.safeParse({
      email: "221@qq.com",
      password: "Password123!",
      role: "DEVELOPER",
      profile: {
        displayName: "dev"
      }
    });

    expect(result.success).toBe(false);
  });

  it("should pass standard qq email", () => {
    const result = registerSchema.safeParse({
      email: "12345@qq.com",
      password: "Password123!",
      role: "DEVELOPER",
      profile: {
        displayName: "dev"
      }
    });

    expect(result.success).toBe(true);
  });
});
