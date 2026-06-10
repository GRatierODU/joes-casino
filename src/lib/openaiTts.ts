/** OpenAI Text-to-Speech voices (tts-1 / tts-1-hd). */
export type OpenAiTtsVoice =
  | "alloy"
  | "ash"
  | "coral"
  | "echo"
  | "fable"
  | "nova"
  | "onyx"
  | "sage"
  | "shimmer";

export function openaiApiKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

/** Returns MP3 bytes, or null on failure. */
export async function synthesizeOpenAiSpeech(
  text: string,
  voice: OpenAiTtsVoice,
  apiKey: string
): Promise<Buffer | null> {
  const model = process.env.OPENAI_TTS_MODEL?.trim() || "tts-1-hd";

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: text,
      voice,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    console.error("openai tts error", res.status, (await res.text()).slice(0, 400));
    return null;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length ? buf : null;
}
