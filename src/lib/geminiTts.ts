import { parsePcmSampleRate, pcm16ToWav } from "@/lib/pcmToWav";

const TTS_MODEL =
  process.env.GEMINI_TTS_MODEL?.trim() || "gemini-2.5-flash-preview-tts";

type GeminiPart = {
  inlineData?: { mimeType?: string; data?: string };
};

export function geminiApiKey(): string | null {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    null
  );
}

/** Returns base64-encoded WAV audio, or null if synthesis fails. */
export async function synthesizeGeminiSpeech(
  text: string,
  speakerName: string,
  voiceName: string,
  apiKey: string
): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Read the following line aloud as ${speakerName}, speaking naturally in a lounge (warm, conversational tone):\n\n${text}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    console.error("gemini tts error", res.status, (await res.text()).slice(0, 400));
    return null;
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: GeminiPart[] } }[];
  };

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((p) => p.inlineData?.data)?.inlineData;
  if (!inline?.data) return null;

  const raw = Buffer.from(inline.data, "base64");
  const mime = inline.mimeType ?? "audio/L16;codec=pcm;rate=24000";

  if (mime.includes("wav")) {
    return raw.toString("base64");
  }
  if (mime.includes("mpeg") || mime.includes("mp3")) {
    return raw.toString("base64");
  }

  const sampleRate = parsePcmSampleRate(mime);
  return pcm16ToWav(raw, sampleRate).toString("base64");
}
