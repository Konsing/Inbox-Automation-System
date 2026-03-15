import { NextRequest } from "next/server";
import { runPipeline } from "@/lib/pipeline";

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
  const body = await request.json();
  const message = body.message?.trim();
  const password = body.password;

  if (process.env.DEMO_PASSWORD && password !== process.env.DEMO_PASSWORD) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!message) {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const pipeline = runPipeline(message);

  const sseGenerator = async function* () {
    try {
      for await (const event of pipeline) {
        const eventType = event.step === "error" ? "error" : "step";
        yield encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`);
      }
      yield encoder.encode(`event: complete\ndata: {}\n\n`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Pipeline failed";
      yield encoder.encode(
        `event: error\ndata: ${JSON.stringify({ error: errorMessage })}\n\n`
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
