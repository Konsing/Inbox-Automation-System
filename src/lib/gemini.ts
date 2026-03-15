import { GoogleGenAI, Type } from "@google/genai";
import type { Classification, Category, Priority, Sentiment, EmailClassification, ReplyDeadline } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = "gemini-2.5-flash";

const VALID_CATEGORIES: Category[] = ["refund", "billing", "technical", "general"];
const VALID_PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
const VALID_SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative"];

export async function classifyMessage(message: string): Promise<Classification> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `You are a customer support classifier. Analyze the following message and return a JSON object with exactly these fields:
- category: one of "refund", "billing", "technical", "general"
- priority: one of "low", "medium", "high", "urgent"
- sentiment: one of "positive", "neutral", "negative"

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
        },
        required: ["category", "priority", "sentiment"],
      },
    },
  });

  const parsed = JSON.parse(response.text ?? "{}");

  return {
    category: VALID_CATEGORIES.includes(parsed.category) ? parsed.category : "general",
    priority: VALID_PRIORITIES.includes(parsed.priority) ? parsed.priority : "medium",
    sentiment: VALID_SENTIMENTS.includes(parsed.sentiment) ? parsed.sentiment : "neutral",
  };
}

export async function generateResponse(
  message: string,
  classification: Classification
): Promise<string> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `You are a professional customer support agent. Write a helpful, empathetic response to this customer message.

Context:
- Category: ${classification.category}
- Priority: ${classification.priority}
- Sentiment: ${classification.sentiment}

Customer message: """${message}"""

Requirements:
- Be professional and empathetic
- Address the specific issue
- Provide actionable next steps
- Keep it concise (2-3 paragraphs)`,
  });

  return response.text ?? "We have received your message and will get back to you shortly.";
}

// --- Email Classification + Reply Generation ---

const VALID_DEADLINES: ReplyDeadline[] = [
  "within 1 hour",
  "within 4 hours",
  "within 24 hours",
  "within 48 hours",
];

export async function classifyEmail(
  subject: string,
  body: string,
  from: string
): Promise<EmailClassification> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `You are an email classifier. Analyze the following email and return a JSON object.

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
        },
        required: ["category", "priority", "sentiment", "summary", "reply_deadline"],
      },
    },
  });

  const parsed = JSON.parse(response.text ?? "{}");

  return {
    category: VALID_CATEGORIES.includes(parsed.category) ? parsed.category : "general",
    priority: VALID_PRIORITIES.includes(parsed.priority) ? parsed.priority : "medium",
    sentiment: VALID_SENTIMENTS.includes(parsed.sentiment) ? parsed.sentiment : "neutral",
    summary: (parsed.summary ?? "No summary available").slice(0, 100),
    reply_deadline: VALID_DEADLINES.includes(parsed.reply_deadline)
      ? parsed.reply_deadline
      : "within 24 hours",
  };
}

export async function generateEmailReply(
  from: string,
  subject: string,
  body: string,
  classification: EmailClassification
): Promise<string> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `You are a professional email assistant. Write a helpful reply to this email.

From: ${from}
Subject: ${subject}
Body: """${body.slice(0, 2000)}"""

Classification:
- Category: ${classification.category}
- Priority: ${classification.priority}
- Sentiment: ${classification.sentiment}

Requirements:
- Professional and empathetic tone
- Address the specific issue
- Provide actionable next steps
- Keep it concise (2-3 paragraphs)
- Do not include a subject line, just the body`,
  });

  return response.text ?? "Thank you for your email. We will review and respond shortly.";
}
