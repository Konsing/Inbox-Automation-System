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

// --- Gmail + Slack Integration Types ---

export interface Account {
  id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Email {
  id: string;
  account_id: string;
  gmail_id: string;
  gmail_message_id: string | null;
  thread_id: string | null;
  from_address: string;
  from_name: string | null;
  subject: string;
  snippet: string | null;
  body_text: string | null;
  received_at: string;
  category: Category | null;
  priority: Priority | null;
  sentiment: Sentiment | null;
  summary: string | null;
  reply_deadline: string | null;
  draft_reply: string | null;
  reply_sent: boolean;
  synced_at: string;
  updated_at: string;
}

export type ReplyDeadline =
  | "within 1 hour"
  | "within 4 hours"
  | "within 24 hours"
  | "within 48 hours";

export interface EmailClassification extends Classification {
  summary: string;
  reply_deadline: ReplyDeadline;
}

export type SyncStep =
  | "authenticating"
  | "fetching"
  | "classifying"
  | "drafting"
  | "storing"
  | "notifying"
  | "done"
  | "error";

export interface SyncEvent {
  step: SyncStep;
  detail: string;
  progress?: { current: number; total: number };
  stats?: { urgent: number; high: number; medium: number; low: number };
  error?: string;
}
