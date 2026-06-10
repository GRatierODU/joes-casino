import { createOpenAI } from "@ai-sdk/openai";
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

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const bodySchema = z.object({
  personaId: z.enum(["easy", "average", "hard"]),
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
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const openai = createOpenAI({ apiKey });
  return openai(process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini");
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
  if (!persona) {
    return NextResponse.json({ error: "Unknown persona." }, { status: 400 });
  }

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
          content:
            "The player just walked up to your table in the lounge. Give a short in-character greeting (1–2 sentences) as Sofia. Set interestDelta based on persona starting energy (small positive or neutral).",
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

Current interest level (0–100): ${priorInterest}. Win threshold for this persona: ${persona.winThreshold}.
Return structured output only.`,
      messages: modelMessages,
      output: Output.object({ schema: replySchema }),
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
      { error: "Could not reach OpenAI. Check your API key and quota." },
      { status: 502 }
    );
  }
}
