import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const correct = process.env.DEMO_PASSWORD;

  if (!correct) {
    return Response.json({ error: "Demo password not configured" }, { status: 500 });
  }

  if (password !== correct) {
    return Response.json({ error: "Incorrect password" }, { status: 401 });
  }

  return Response.json({ ok: true });
}
