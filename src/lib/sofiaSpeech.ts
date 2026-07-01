import type { ChatPersonaId } from "./chatPersonas";
import { stripAudioTags } from "./audioTags";

export type SpeakSofiaOptions = {
  enabled?: boolean;
  personaId?: ChatPersonaId | null;
  /** Clean text for on-screen word reveal; defaults to speech with tags stripped. */
  displayText?: string;
  onStart?: () => void;
  onReveal?: (revealedText: string) => void;
  onEnd?: () => void;
};

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
let activeAbort: AbortController | null = null;
let activeCancel: (() => void) | null = null;

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

function pickMaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const prefer = /david|mark|aaron|guy|james|daniel|paul|male|fred|richard/i;
  const male = en.filter((v) => !/zira|samantha|victoria|jenny|aria|susan|karen|moira|tessa|female|natasha/i.test(v.name));
  return male.find((v) => prefer.test(v.name)) ?? male[0] ?? en[0] ?? voices[0];
}

function speakWithBrowser(
  displayText: string,
  opts: SpeakSofiaOptions,
  signal?: AbortSignal
): Promise<() => void> {
  return loadVoices().then((voices) => {
    if (signal?.aborted) return () => {};

    if (!window.speechSynthesis) {
      opts.onReveal?.(displayText);
      opts.onEnd?.();
      return () => {};
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(displayText);
    const isKacey = opts.personaId === "kacey";
    const isMale =
      opts.personaId === "better-joe" || opts.personaId === "yoshua";
    const voice = isMale ? pickMaleVoice(voices) : pickFemaleVoice(voices);
    if (voice) utterance.voice = voice;
    utterance.rate = isKacey ? 0.92 : 0.96;
    utterance.pitch = isKacey ? 0.9 : isMale ? 0.98 : 1.04;
    utterance.volume = isKacey ? 0.75 : 1;
    utterance.lang = voice?.lang ?? "en-US";

    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      if (activeCancel === cancel) activeCancel = null;
      opts.onReveal?.(displayText);
      opts.onEnd?.();
    };

    const cancel = () => {
      window.speechSynthesis.cancel();
      finish();
    };

    utterance.onstart = () => {
      if (signal?.aborted) {
        cancel();
        return;
      }
      opts.onStart?.();
      opts.onReveal?.("");
    };
    utterance.onboundary = (ev) => {
      if (ev.name !== "word" || ev.charIndex === undefined) return;
      const end = ev.charIndex + (ev.charLength ?? 0);
      opts.onReveal?.(displayText.slice(0, end));
    };
    utterance.onend = () => {
      if (activeCancel === cancel) activeCancel = null;
      finish();
    };
    utterance.onerror = () => {
      if (activeCancel === cancel) activeCancel = null;
      finish();
    };

    activeCancel = cancel;
    window.speechSynthesis.speak(utterance);

    return cancel;
  });
}

async function speakWithGemini(
  speechText: string,
  displayText: string,
  opts: SpeakSofiaOptions,
  signal?: AbortSignal
): Promise<(() => void) | null> {
  if (signal?.aborted) return null;

  const res = await fetch("/api/chat/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: speechText, personaId: opts.personaId ?? undefined }),
    signal,
  });
  if (!res.ok || signal?.aborted) return null;

  const blob = await res.blob();
  if (!blob.size || signal?.aborted) return null;

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.volume = opts.personaId === "kacey" ? 0.72 : 1;
  let ended = false;
  let rafId = 0;
  const wordCount = splitSpeechTokens(displayText).length;
  const estimatedDuration = Math.max(1.2, wordCount / 2.4);

  const syncReveal = () => {
    const duration =
      audio.duration && Number.isFinite(audio.duration) ? audio.duration : estimatedDuration;
    const ratio = duration > 0 ? Math.min(1, audio.currentTime / duration) : 0;
    opts.onReveal?.(revealTextByProgress(displayText, ratio));
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
    if (activeCancel === cancel) activeCancel = null;
    opts.onReveal?.(displayText);
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
    if (signal?.aborted) {
      finish();
      return null;
    }
    await audio.play();
    if (signal?.aborted) {
      cancel();
      return null;
    }
    activeCancel = cancel;
    rafId = requestAnimationFrame(tick);
  } catch {
    finish();
    return null;
  }

  return cancel;
}

function abortActiveSpeech(): void {
  activeAbort?.abort();
  activeAbort = null;
  activeCancel?.();
  activeCancel = null;
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/** Speak a line. Tries Gemini TTS first, then browser voices. Returns cancel fn. */
export async function speakSofia(
  speechText: string,
  opts: SpeakSofiaOptions = {}
): Promise<() => void> {
  const trimmed = speechText.trim();
  const displayText = (opts.displayText ?? stripAudioTags(trimmed)).trim();
  if (!trimmed || opts.enabled === false) {
    opts.onReveal?.(displayText);
    opts.onEnd?.();
    return () => {};
  }

  abortActiveSpeech();
  const controller = new AbortController();
  activeAbort = controller;
  const noop = () => {};

  try {
    const geminiCancel = await speakWithGemini(trimmed, displayText, opts, controller.signal);
    if (activeAbort === controller) activeAbort = null;
    if (controller.signal.aborted) {
      geminiCancel?.();
      return noop;
    }
    if (geminiCancel) return geminiCancel;
  } catch {
    if (activeAbort === controller) activeAbort = null;
    if (controller.signal.aborted) return noop;
  }

  if (controller.signal.aborted) return noop;

  return (
    (await speakWithBrowser(displayText, opts, controller.signal)) ??
    noop
  );
}

export function stopSofiaSpeech(): void {
  abortActiveSpeech();
}
