import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clampInterest,
  getPersona,
  type ChatMood,
  type ChatPersonaId,
} from "@/lib/chatPersonas";

export const runtime = "nodejs";

const GEMINI_SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT" as const, threshold: "BLOCK_ONLY_HIGH" as const },
  { category: "HARM_CATEGORY_HATE_SPEECH" as const, threshold: "BLOCK_ONLY_HIGH" as const },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" as const, threshold: "BLOCK_ONLY_HIGH" as const },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT" as const, threshold: "BLOCK_ONLY_HIGH" as const },
];

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const bodySchema = z.object({
  personaId: z.enum(["easy", "hard"]).optional(),
  interest: z.number().min(0).max(100),
  messages: z.array(messageSchema).max(80),
  opening: z.boolean().optional(),
});

const replySchema = z.object({
  reply: z.string().min(1).max(1200),
  interestDelta: z.number().min(-18).max(18),
  mood: z.enum(["cold", "curious", "warm", "flirty", "smitten"]),
});

function getModel() {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) is not configured."
    );
  }
  const google = createGoogleGenerativeAI({ apiKey });
  return google(process.env.GEMINI_CHAT_MODEL?.trim() || "gemini-2.5-flash");
}

export async function POST(request: Request) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    parsed = bodySchema.parse(json);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const persona = getPersona(parsed.personaId);

  let model;
  try {
    model = getModel();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI not configured.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const opening = parsed.opening === true || parsed.messages.length === 0;
  const priorInterest = clampInterest(parsed.interest);

  const modelMessages = opening
    ? [
        {
          role: "user" as const,
          content: `The player just walked up to flirt with you in the VIP lounge. Give a short in-character greeting (1–2 sentences) as ${persona.name}—you know they're interested, but you haven't agreed to anything yet. Set interestDelta based on persona starting energy.`,
        },
      ]
    : parsed.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

  try {
    const { output } = await generateText({
      model,
      system: `${persona.systemPrompt}

Current attraction (0–100): ${priorInterest}. If attraction is at or above ${persona.winThreshold}, ${persona.name} agrees to leave with the player and go home together tonight (say yes in character—suggestive, not graphic). Below that, ${persona.subjectPronoun === "he" ? "he" : "she"} keeps flirting, deflecting, or holding back depending on persona.
Return structured output only.`,
      messages: modelMessages,
      output: Output.object({ schema: replySchema }),
      providerOptions: {
        google: {
          structuredOutputs: true,
          safetySettings: GEMINI_SAFETY_SETTINGS,
        },
      },
    });

    if (!output) {
      return NextResponse.json({ error: "No response from model." }, { status: 502 });
    }

    const interest = clampInterest(priorInterest + output.interestDelta);
    const won = interest >= persona.winThreshold;
    const lost = !opening && interest <= 8 && parsed.messages.length >= 4;

    return NextResponse.json({
      reply: output.reply.trim(),
      interest,
      interestDelta: output.interestDelta,
      mood: output.mood as ChatMood,
      won,
      lost,
      personaId: persona.id as ChatPersonaId,
    });
  } catch (e) {
    console.error("chat api error", e);
    return NextResponse.json(
      { error: "Could not reach Gemini. Check your API key and quota." },
      { status: 502 }
    );
  }
}
