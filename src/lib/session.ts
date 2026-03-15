import { createHmac } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "inbox_session";
const MAX_AGE = 604800; // 7 days

function sign(value: string): string {
  const signature = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(value)
    .digest("hex");
  return `${value}.${signature}`;
}

function verify(signed: string): string | null {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;

  const value = signed.slice(0, lastDot);
  const expected = sign(value);

  if (expected !== signed) return null;
  return value;
}

export async function setSession(accountId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sign(accountId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie) return null;
  return verify(cookie.value);
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function setOAuthState(state: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });
}

export async function getOAuthState(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get("oauth_state");
  if (!cookie) return null;
  return cookie.value;
}
