import { NextResponse } from "next/server";
import { z } from "zod";
import { buildKaceyTtsPrompt } from "@/lib/audioTags";
import { getPersona, type ChatPersonaId } from "@/lib/chatPersonas";
import { parsePcmSampleRate, pcm16ToWav } from "@/lib/pcmToWav";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1).max(1200),
  personaId: z.enum(["easy"]).optional(),
});

const TTS_MODEL =
  process.env.GEMINI_TTS_MODEL?.trim() || "gemini-2.5-flash-preview-tts";
const DEFAULT_TTS_VOICE = process.env.GEMINI_TTS_VOICE?.trim() || "Leda";

function geminiApiKey(): string | null {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    null
  );
}

type GeminiPart = {
  inlineData?: { mimeType?: string; data?: string };
};

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
  const voiceName = persona?.ttsVoice ?? DEFAULT_TTS_VOICE;

  const apiKey = geminiApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Gemini API key not configured." }, { status: 503 });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildKaceyTtsPrompt(text, voiceName),
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("gemini tts error", res.status, errText.slice(0, 400));
      return NextResponse.json({ error: "TTS unavailable." }, { status: 502 });
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
    };

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const audioPart = parts.find((p) => p.inlineData?.data);
    const inline = audioPart?.inlineData;
    if (!inline?.data) {
      return NextResponse.json({ error: "No audio in response." }, { status: 502 });
    }

    const raw = Buffer.from(inline.data, "base64");
    const mime = inline.mimeType ?? "audio/L16;codec=pcm;rate=24000";

    const toBody = (buf: Buffer) => new Uint8Array(buf);

    if (mime.includes("wav")) {
      return new NextResponse(toBody(raw), {
        headers: {
          "Content-Type": "audio/wav",
          "Cache-Control": "no-store",
        },
      });
    }

    if (mime.includes("mpeg") || mime.includes("mp3")) {
      return new NextResponse(toBody(raw), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
        },
      });
    }

    const sampleRate = parsePcmSampleRate(mime);
    const wav = pcm16ToWav(raw, sampleRate);

    return new NextResponse(toBody(wav), {
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
