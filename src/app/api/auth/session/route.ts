import { getSupabase } from "@/lib/supabase";
import { getSession, clearSession } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";

export async function GET() {
  const accountId = await getSession();
  if (!accountId) {
    return Response.json({ connected: false });
  }

  const supabase = getSupabase();
  const { data: account } = await supabase
    .from("accounts")
    .select("email")
    .eq("id", accountId)
    .single();

  if (!account) {
    await clearSession();
    return Response.json({ connected: false });
  }

  return Response.json({ connected: true, email: account.email });
}

export async function DELETE() {
  const accountId = await getSession();
  if (!accountId) {
    return Response.json({ ok: true });
  }

  const supabase = getSupabase();

  // Try to revoke the Google token
  try {
    const { data: account } = await supabase
      .from("accounts")
      .select("access_token")
      .eq("id", accountId)
      .single();

    if (account) {
      const token = decryptToken(account.access_token);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
        method: "POST",
      });
    }
  } catch {
    // Revocation is best-effort
  }

  // Delete account and clear session
  await supabase.from("accounts").delete().eq("id", accountId);
  await clearSession();

  return Response.json({ ok: true });
}
