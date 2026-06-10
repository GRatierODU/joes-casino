import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersona, type ChatPersonaId } from "@/lib/chatPersonas";
import { synthesizeForPersona } from "@/lib/personaTts";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1).max(1200),
  personaId: z.enum(["easy", "average", "hard"]).optional(),
});

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

  const persona = personaId ? getPersona(personaId) : getPersona("easy");
  if (!persona) {
    return NextResponse.json({ error: "Unknown persona." }, { status: 400 });
  }

  try {
    const audio = await synthesizeForPersona(persona, text);
    if (!audio) {
      return NextResponse.json({ error: "TTS unavailable." }, { status: 502 });
    }

    const raw = Buffer.from(audio.audioBase64, "base64");
    return new NextResponse(new Uint8Array(raw), {
      headers: {
        "Content-Type": audio.audioMime,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("tts route error", e);
    return NextResponse.json({ error: "TTS failed." }, { status: 502 });
  }
}
