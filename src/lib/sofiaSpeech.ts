import type { ChatPersonaId } from "./chatPersonas";

export type SpeakSofiaOptions = {
  enabled?: boolean;
  personaId?: ChatPersonaId | null;
  onStart?: () => void;
  onReveal?: (revealedText: string) => void;
  onEnd?: () => void;
};

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

/** Split text into word tokens (word + trailing whitespace). */
export function splitSpeechTokens(text: string): string[] {
  const tokens = text.match(/\S+\s*/g);
  return tokens ?? (text ? [text] : []);
}

/** Reveal text word-by-word from a 0–1 progress ratio. */
export function revealTextByProgress(text: string, ratio: number): string {
  if (ratio >= 1) return text;
  const tokens = splitSpeechTokens(text);
  if (!tokens.length) return "";
  const count = Math.max(1, Math.ceil(ratio * tokens.length));
  return tokens.slice(0, count).join("");
}

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
      opts.onReveal?.(text);
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
      opts.onReveal?.(text);
      opts.onEnd?.();
    };

    utterance.onstart = () => {
      opts.onStart?.();
      opts.onReveal?.("");
    };
    utterance.onboundary = (ev) => {
      if (ev.name !== "word" || ev.charIndex === undefined) return;
      const end = ev.charIndex + (ev.charLength ?? 0);
      opts.onReveal?.(text.slice(0, end));
    };
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
  let rafId = 0;
  const wordCount = splitSpeechTokens(text).length;
  const estimatedDuration = Math.max(1.2, wordCount / 2.4);

  const syncReveal = () => {
    const duration =
      audio.duration && Number.isFinite(audio.duration) ? audio.duration : estimatedDuration;
    const ratio = duration > 0 ? Math.min(1, audio.currentTime / duration) : 0;
    opts.onReveal?.(revealTextByProgress(text, ratio));
  };

  const tick = () => {
    if (ended) return;
    syncReveal();
    rafId = requestAnimationFrame(tick);
  };

  const finish = () => {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(rafId);
    audio.removeEventListener("timeupdate", syncReveal);
    audio.removeEventListener("ended", finish);
    audio.removeEventListener("error", finish);
    URL.revokeObjectURL(url);
    opts.onReveal?.(text);
    opts.onEnd?.();
  };

  const cancel = () => {
    audio.pause();
    audio.currentTime = 0;
    finish();
  };

  audio.addEventListener("timeupdate", syncReveal);
  audio.addEventListener("ended", finish);
  audio.addEventListener("error", finish);

  opts.onStart?.();
  opts.onReveal?.("");

  try {
    await audio.play();
    rafId = requestAnimationFrame(tick);
  } catch {
    finish();
    return null;
  }

  return cancel;
}

/** Speak a line. Tries Gemini TTS first, then browser voices. Returns cancel fn. */
export async function speakSofia(
  text: string,
  opts: SpeakSofiaOptions = {}
): Promise<() => void> {
  const trimmed = text.trim();
  if (!trimmed || opts.enabled === false) {
    opts.onReveal?.(trimmed);
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
