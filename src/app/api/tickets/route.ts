import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  const { data: tickets, error, count } = await supabase
    .from("tickets")
    .select("*", { count: "exact" })
    .in("status", ["done", "error"])
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json({
    tickets: tickets ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}
