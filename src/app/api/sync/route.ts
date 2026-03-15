import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { runSyncPipeline } from "@/lib/sync-pipeline";

function iteratorToStream(iterator: AsyncGenerator) {
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    cancel() {
      iterator.return(undefined);
    },
  });
}

export async function POST(request: NextRequest) {
  const accountId = await getSession();
  if (!accountId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const pipeline = runSyncPipeline(accountId);

  const sseGenerator = async function* () {
    try {
      for await (const event of pipeline) {
        const eventType = event.step === "error" ? "error" : "step";
        yield encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`);
      }
      yield encoder.encode(`event: complete\ndata: {}\n\n`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sync failed";
      yield encoder.encode(
        `event: error\ndata: ${JSON.stringify({ step: "error", detail: errorMessage, error: errorMessage })}\n\n`
      );
    }
  };

  const stream = iteratorToStream(sseGenerator());

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
