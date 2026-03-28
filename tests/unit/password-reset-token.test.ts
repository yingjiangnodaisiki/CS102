import {
  getPasswordHashFingerprint,
  signEmailVerificationToken,
  verifyEmailVerificationToken
} from "@/lib/utils/email-verification-token";

describe("email verification token util", () => {
  const oldEnv = process.env.JWT_EMAIL_VERIFY_SECRET;

  beforeAll(() => {
    process.env.JWT_EMAIL_VERIFY_SECRET = "test-email-verify-secret";
  });

  afterAll(() => {
    process.env.JWT_EMAIL_VERIFY_SECRET = oldEnv;
  });

  it("should sign and verify forgot-password token", () => {
    const token = signEmailVerificationToken({
      userId: "user-1",
      email: "demo@example.com",
      passwordHash: "hash-value",
      purpose: "FORGOT_PASSWORD"
    });
    const payload = verifyEmailVerificationToken(token, "FORGOT_PASSWORD");

    expect(payload.userId).toBe("user-1");
    expect(payload.email).toBe("demo@example.com");
    expect(payload.purpose).toBe("FORGOT_PASSWORD");
    expect(payload.fingerprint).toBe(getPasswordHashFingerprint("hash-value"));
  });

  it("should sign and verify register-email token", () => {
    const token = signEmailVerificationToken({
      userId: "user-2",
      email: "reg@example.com",
      passwordHash: "hash-2",
      purpose: "REGISTER_EMAIL"
    });
    const payload = verifyEmailVerificationToken(token, "REGISTER_EMAIL");
    expect(payload.purpose).toBe("REGISTER_EMAIL");
    expect(payload.userId).toBe("user-2");
  });
});
