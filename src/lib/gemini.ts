import { GoogleGenAI, Type } from "@google/genai";
import type { Classification, Category, Priority, Sentiment, EmailClassification, ReplyDeadline } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = "gemini-3.1-flash-lite";

const VALID_CATEGORIES: Category[] = ["refund", "billing", "technical", "general"];
const VALID_PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
const VALID_SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative"];

export async function classifyAndRespond(
  message: string
): Promise<{ classification: Classification; aiResponse: string }> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `You are a professional customer support agent. Analyze the following message and return a JSON object with:
1. Classification (category, priority, sentiment)
2. A professional, empathetic response that addresses the issue and provides actionable next steps (2-3 paragraphs)

Message: """${message}"""`,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            description: "The category of the message",
            enum: VALID_CATEGORIES,
          },
          priority: {
            type: Type.STRING,
            description: "The priority level",
            enum: VALID_PRIORITIES,
          },
          sentiment: {
            type: Type.STRING,
            description: "The sentiment of the message",
            enum: VALID_SENTIMENTS,
          },
          ai_response: {
            type: Type.STRING,
            description: "A professional, empathetic customer support response (2-3 paragraphs)",
          },
        },
        required: ["category", "priority", "sentiment", "ai_response"],
      },
    },
  });

  const parsed = JSON.parse(response.text ?? "{}");

  return {
    classification: {
      category: VALID_CATEGORIES.includes(parsed.category) ? parsed.category : "general",
      priority: VALID_PRIORITIES.includes(parsed.priority) ? parsed.priority : "medium",
      sentiment: VALID_SENTIMENTS.includes(parsed.sentiment) ? parsed.sentiment : "neutral",
    },
    aiResponse: parsed.ai_response ?? "We have received your message and will get back to you shortly.",
  };
}

// --- Email Classification + Reply Generation ---

const VALID_DEADLINES: ReplyDeadline[] = [
  "within 1 hour",
  "within 4 hours",
  "within 24 hours",
  "within 48 hours",
];

export async function classifyAndRespondEmail(
  subject: string,
  body: string,
  from: string
): Promise<{ classification: EmailClassification; draftReply: string }> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `You are a professional email assistant. Analyze the following email and return a JSON object with:
1. Classification (category, priority, sentiment, summary, reply_deadline)
2. A professional, empathetic draft reply that addresses the issue and provides actionable next steps (2-3 paragraphs, no subject line)

From: ${from}
Subject: ${subject}
Body: """${body.slice(0, 2000)}"""`,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            enum: VALID_CATEGORIES,
          },
          priority: {
            type: Type.STRING,
            enum: VALID_PRIORITIES,
          },
          sentiment: {
            type: Type.STRING,
            enum: VALID_SENTIMENTS,
          },
          summary: {
            type: Type.STRING,
            description: "One-line summary of the email, max 100 characters",
          },
          reply_deadline: {
            type: Type.STRING,
            description: "Suggested reply timeframe",
            enum: VALID_DEADLINES,
          },
          draft_reply: {
            type: Type.STRING,
            description: "Professional draft reply (2-3 paragraphs, no subject line)",
          },
        },
        required: ["category", "priority", "sentiment", "summary", "reply_deadline", "draft_reply"],
      },
    },
  });

  const parsed = JSON.parse(response.text ?? "{}");

  return {
    classification: {
      category: VALID_CATEGORIES.includes(parsed.category) ? parsed.category : "general",
      priority: VALID_PRIORITIES.includes(parsed.priority) ? parsed.priority : "medium",
      sentiment: VALID_SENTIMENTS.includes(parsed.sentiment) ? parsed.sentiment : "neutral",
      summary: (parsed.summary ?? "No summary available").slice(0, 100),
      reply_deadline: VALID_DEADLINES.includes(parsed.reply_deadline)
        ? parsed.reply_deadline
        : "within 24 hours",
    },
    draftReply: parsed.draft_reply ?? "Thank you for your email. We will review and respond shortly.",
  };
}
