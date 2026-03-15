import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(plaintext: string): string {
  const key = deriveKey(process.env.SESSION_SECRET!);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${encrypted}:${tag.toString("base64")}`;
}

export function decryptToken(encrypted: string): string {
  const key = deriveKey(process.env.SESSION_SECRET!);
  const [ivB64, ciphertext, tagB64] = encrypted.split(":");

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
