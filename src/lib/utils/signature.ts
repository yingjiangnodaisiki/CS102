import crypto from "node:crypto";

export function createHmacSha256(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyHmacSha256Signature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmacSha256(payload, secret);
  if (expected.length !== signature.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
