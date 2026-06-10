import type { ChatPersona } from "@/lib/chatPersonas";
import { geminiApiKey, synthesizeGeminiSpeech } from "@/lib/geminiTts";
import { openaiApiKey, synthesizeOpenAiSpeech } from "@/lib/openaiTts";

export type PersonaAudio = {
  audioBase64: string;
  audioMime: "audio/mpeg" | "audio/wav";
};

/** Prefer OpenAI TTS (better character voices), then Gemini. */
export async function synthesizeForPersona(
  persona: ChatPersona,
  text: string
): Promise<PersonaAudio | null> {
  const openaiKey = openaiApiKey();
  if (openaiKey) {
    const mp3 = await synthesizeOpenAiSpeech(text, persona.openaiVoice, openaiKey);
    if (mp3) {
      return { audioBase64: mp3.toString("base64"), audioMime: "audio/mpeg" };
    }
  }

  const geminiKey = geminiApiKey();
  if (geminiKey) {
    const wavBase64 = await synthesizeGeminiSpeech(
      text,
      persona.name,
      persona.geminiVoice,
      geminiKey
    );
    if (wavBase64) {
      return { audioBase64: wavBase64, audioMime: "audio/wav" };
    }
  }

  return null;
}
