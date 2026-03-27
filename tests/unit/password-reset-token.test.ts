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
});
