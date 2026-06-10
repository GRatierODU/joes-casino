import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersona, type ChatPersonaId } from "@/lib/chatPersonas";
import { geminiApiKey, synthesizePersonaSpeech } from "@/lib/geminiTts";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1).max(1200),
  personaId: z.enum(["easy", "average", "hard"]).optional(),
});

const DEFAULT_TTS_VOICE = process.env.GEMINI_TTS_VOICE?.trim() || "Aoede";

export async function POST(request: Request) {
  let text: string;
  let personaId: ChatPersonaId | undefined;
  try {
    const json = await request.json();
    const parsed = bodySchema.parse(json);
    text = parsed.text.trim();
    personaId = parsed.personaId;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const persona = personaId ? getPersona(personaId) : null;
  const apiKey = geminiApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Gemini API key not configured." }, { status: 503 });
  }

  try {
    const wavBase64 = await synthesizePersonaSpeech(
      text,
      persona?.name ?? "Sofia",
      persona?.ttsVoice ?? DEFAULT_TTS_VOICE,
      apiKey
    );
    if (!wavBase64) {
      return NextResponse.json({ error: "TTS unavailable." }, { status: 502 });
    }

    const raw = Buffer.from(wavBase64, "base64");
    return new NextResponse(new Uint8Array(raw), {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("tts route error", e);
    return NextResponse.json({ error: "TTS failed." }, { status: 502 });
  }
}
