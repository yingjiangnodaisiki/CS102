import bcrypt from "bcryptjs";

const PASSWORD_SALT_ROUNDS = 12;

export async function hashPassword(rawPassword: string): Promise<string> {
  return bcrypt.hash(rawPassword, PASSWORD_SALT_ROUNDS);
}

export async function verifyPassword(rawPassword: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(rawPassword, hashed);
}
