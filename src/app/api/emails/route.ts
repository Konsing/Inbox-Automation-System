import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const accountId = await getSession();
  if (!accountId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const priority = searchParams.get("priority");
  const category = searchParams.get("category");
  const offset = (page - 1) * limit;

  const supabase = getSupabase();
  let query = supabase
    .from("emails")
    .select("*", { count: "exact" })
    .eq("account_id", accountId)
    .order("received_at", { ascending: false });

  if (priority) query = query.eq("priority", priority);
  if (category) query = query.eq("category", category);

  const { data: emails, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Sort by priority weight (urgent first) since Supabase can't sort TEXT by custom order
  const priorityWeight: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sorted = (emails ?? []).sort(
    (a, b) => (priorityWeight[a.priority ?? "medium"] ?? 2) - (priorityWeight[b.priority ?? "medium"] ?? 2)
  );

  return Response.json({
    emails: sorted,
    total: count ?? 0,
    page,
    limit,
  });
}
