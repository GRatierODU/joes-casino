import type { ChatPersonaId } from "./chatPersonas";

export type SpeakSofiaOptions = {
  enabled?: boolean;
  personaId?: ChatPersonaId | null;
  onStart?: () => void;
  onEnd?: () => void;
};

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve([]);
  }
  if (voicesReady) return voicesReady;

  voicesReady = new Promise((resolve) => {
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length) resolve(voices);
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 250);
  });

  return voicesReady;
}

function pickFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const prefer =
    /zira|samantha|victoria|jenny|aria|susan|karen|moira|tessa|female|natasha/i;
  return en.find((v) => prefer.test(v.name)) ?? en[0] ?? voices[0];
}

function speakWithBrowser(
  text: string,
  opts: SpeakSofiaOptions
): Promise<() => void> {
  return loadVoices().then((voices) => {
    if (!window.speechSynthesis) {
      opts.onEnd?.();
      return () => {};
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickFemaleVoice(voices);
    if (voice) utterance.voice = voice;
    utterance.rate = 0.96;
    utterance.pitch = 1.04;
    utterance.lang = voice?.lang ?? "en-US";

    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      opts.onEnd?.();
    };

    utterance.onstart = () => opts.onStart?.();
    utterance.onend = finish;
    utterance.onerror = finish;

    window.speechSynthesis.speak(utterance);

    return () => {
      window.speechSynthesis.cancel();
      finish();
    };
  });
}

async function speakWithGemini(
  text: string,
  opts: SpeakSofiaOptions
): Promise<(() => void) | null> {
  const res = await fetch("/api/chat/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, personaId: opts.personaId ?? undefined }),
  });
  if (!res.ok) return null;

  const blob = await res.blob();
  if (!blob.size) return null;

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  let ended = false;

  const finish = () => {
    if (ended) return;
    ended = true;
    URL.revokeObjectURL(url);
    opts.onEnd?.();
  };

  const cancel = () => {
    audio.pause();
    audio.currentTime = 0;
    finish();
  };

  audio.onended = finish;
  audio.onerror = finish;

  opts.onStart?.();
  try {
    await audio.play();
  } catch {
    finish();
    return null;
  }

  return cancel;
}

/** Speak Sofia's line. Tries Gemini TTS first, then browser voices. Returns cancel fn. */
export async function speakSofia(
  text: string,
  opts: SpeakSofiaOptions = {}
): Promise<() => void> {
  const trimmed = text.trim();
  if (!trimmed || opts.enabled === false) {
    opts.onEnd?.();
    return () => {};
  }

  try {
    const geminiCancel = await speakWithGemini(trimmed, opts);
    if (geminiCancel) return geminiCancel;
  } catch {
    /* fall through */
  }

  return speakWithBrowser(trimmed, opts);
}

export function stopSofiaSpeech(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
