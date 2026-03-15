import { NextRequest } from "next/server";
import { google } from "googleapis";
import { getSupabase } from "@/lib/supabase";
import { encryptToken } from "@/lib/crypto";
import { setSession, getOAuthState } from "@/lib/session";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const baseUrl = request.nextUrl.origin;

  // Verify CSRF state
  const storedState = await getOAuthState();
  if (!state || !storedState || state !== storedState) {
    return Response.redirect(`${baseUrl}/dashboard?error=csrf_failed`);
  }

  if (!code) {
    return Response.redirect(`${baseUrl}/dashboard?error=auth_failed`);
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI!
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return Response.redirect(`${baseUrl}/dashboard?error=auth_failed`);
    }

    // Get user email
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.email) {
      return Response.redirect(`${baseUrl}/dashboard?error=auth_failed`);
    }

    // Encrypt tokens
    const encryptedAccess = encryptToken(tokens.access_token);
    const encryptedRefresh = encryptToken(tokens.refresh_token);
    const tokenExpiry = new Date(tokens.expiry_date ?? Date.now() + 3600000).toISOString();

    // Upsert account
    const supabase = getSupabase();
    const { data: account, error } = await supabase
      .from("accounts")
      .upsert(
        {
          email: userInfo.email,
          access_token: encryptedAccess,
          refresh_token: encryptedRefresh,
          token_expiry: tokenExpiry,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      )
      .select()
      .single();

    if (error || !account) {
      return Response.redirect(`${baseUrl}/dashboard?error=auth_failed`);
    }

    // Set session cookie
    await setSession(account.id);

    return Response.redirect(`${baseUrl}/dashboard`);
  } catch {
    return Response.redirect(`${baseUrl}/dashboard?error=auth_failed`);
  }
}
