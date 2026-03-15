import { GoogleGenAI, Type } from "@google/genai";
import type { Classification, Category, Priority, Sentiment } from "./types";

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
