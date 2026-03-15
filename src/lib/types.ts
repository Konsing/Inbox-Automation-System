export type Category = "refund" | "billing" | "technical" | "general";
export type Priority = "low" | "medium" | "high" | "urgent";
export type Sentiment = "positive" | "neutral" | "negative";
export type TicketStatus =
  | "received"
  | "classifying"
  | "classified"
  | "generating"
  | "stored"
  | "done"
  | "error";

export type PipelineStepStatus = "waiting" | "active" | "complete" | "error";

export interface Ticket {
  id: string;
  message: string;
  category: Category | null;
  priority: Priority | null;
  sentiment: Sentiment | null;
  ai_response: string | null;
  status: TicketStatus;
  error_message: string | null;
  created_at: string;
  classified_at: string | null;
  responded_at: string | null;
  completed_at: string | null;
}

export interface Classification {
  category: Category;
  priority: Priority;
  sentiment: Sentiment;
}

export interface PipelineEvent {
  step: TicketStatus;
  ticket: Ticket;
  error?: string;
}

export interface PipelineStep {
  id: string;
  label: string;
  description: string;
  status: PipelineStepStatus;
  detail?: string;
}
