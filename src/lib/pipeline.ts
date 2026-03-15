import { getSupabase } from "./supabase";
import { classifyMessage, generateResponse } from "./gemini";
import type { PipelineEvent, Ticket } from "./types";

export async function* runPipeline(message: string): AsyncGenerator<PipelineEvent> {
  const supabase = getSupabase();

  // Step 1: Create ticket
  const { data: ticket, error: insertError } = await supabase
    .from("tickets")
    .insert({ message, status: "received" })
    .select()
    .single();

  if (insertError || !ticket) {
    throw new Error(`Failed to create ticket: ${insertError?.message}`);
  }

  yield { step: "received", ticket: ticket as Ticket };

  // Step 2: Classify with AI
  yield { step: "classifying", ticket: ticket as Ticket };

  try {
    const classification = await classifyMessage(message);

    const { data: classifiedTicket, error: classifyError } = await supabase
      .from("tickets")
      .update({
        category: classification.category,
        priority: classification.priority,
        sentiment: classification.sentiment,
        status: "classified",
        classified_at: new Date().toISOString(),
      })
      .eq("id", ticket.id)
      .select()
      .single();

    if (classifyError || !classifiedTicket) {
      throw new Error(`Failed to update classification: ${classifyError?.message}`);
    }

    yield { step: "classified", ticket: classifiedTicket as Ticket };

    // Step 3: Generate AI response
    yield { step: "generating", ticket: classifiedTicket as Ticket };

    const aiResponse = await generateResponse(message, classification);

    const { data: completedTicket, error: responseError } = await supabase
      .from("tickets")
      .update({
        ai_response: aiResponse,
        status: "done",
        responded_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq("id", ticket.id)
      .select()
      .single();

    if (responseError || !completedTicket) {
      throw new Error(`Failed to update response: ${responseError?.message}`);
    }

    yield { step: "done", ticket: completedTicket as Ticket };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await supabase
      .from("tickets")
      .update({ status: "error", error_message: errorMessage })
      .eq("id", ticket.id);

    yield {
      step: "error",
      ticket: { ...ticket, status: "error", error_message: errorMessage } as Ticket,
      error: errorMessage,
    };
  }
}
