import { createHmacSha256, verifyHmacSha256Signature } from "@/lib/utils/signature";

describe("signature util", () => {
  it("should verify valid signature", () => {
    const payload = JSON.stringify({ orderNo: "ESC001", paymentStatus: "SUCCESS" });
    const secret = "secret-key";
    const signature = createHmacSha256(payload, secret);
    expect(verifyHmacSha256Signature(payload, signature, secret)).toBe(true);
  });

  it("should reject invalid signature", () => {
    const payload = JSON.stringify({ orderNo: "ESC001", paymentStatus: "SUCCESS" });
    expect(verifyHmacSha256Signature(payload, "invalid", "secret-key")).toBe(false);
  });
});
