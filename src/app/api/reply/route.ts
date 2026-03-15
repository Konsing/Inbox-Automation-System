import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";
import { sendReply } from "@/lib/gmail";

export async function POST(request: NextRequest) {
  const accountId = await getSession();
  if (!accountId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { emailId, body } = await request.json();

  if (!emailId || !body?.trim()) {
    return Response.json({ error: "Email ID and reply body are required" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Fetch the email
  const { data: email, error: emailError } = await supabase
    .from("emails")
    .select("*")
    .eq("id", emailId)
    .eq("account_id", accountId)
    .single();

  if (emailError || !email) {
    return Response.json({ error: "Email not found" }, { status: 404 });
  }

  // Fetch account email
  const { data: account } = await supabase
    .from("accounts")
    .select("email")
    .eq("id", accountId)
    .single();

  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    await sendReply(accountId, {
      to: email.from_address,
      subject: email.subject,
      body: body.trim(),
      threadId: email.thread_id,
      inReplyTo: email.gmail_message_id,
      fromEmail: account.email,
    });

    // Mark as sent
    await supabase
      .from("emails")
      .update({ reply_sent: true, updated_at: new Date().toISOString() })
      .eq("id", emailId);

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send reply";
    return Response.json({ error: message }, { status: 500 });
  }
}
