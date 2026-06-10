import type { ChatPersonaId } from "./chatPersonas";

export type PlayPersonaSpeechOptions = {
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

function speakWithBrowser(text: string, opts: PlayPersonaSpeechOptions): Promise<() => void> {
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

function playWavBase64(base64: string, opts: PlayPersonaSpeechOptions): Promise<() => void> {
  return new Promise((resolve, reject) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "audio/wav" });
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
    audio.onerror = () => {
      finish();
      reject(new Error("audio playback failed"));
    };
    opts.onStart?.();

    audio.play().then(() => resolve(cancel)).catch(reject);
  });
}

/** Play pre-generated WAV (from chat API) or fall back to browser TTS. */
export async function playPersonaSpeech(
  text: string,
  opts: PlayPersonaSpeechOptions & { audioWavBase64?: string | null } = {}
): Promise<() => void> {
  const trimmed = text.trim();
  if (!trimmed) {
    opts.onEnd?.();
    return () => {};
  }

  stopPersonaSpeech();

  if (opts.audioWavBase64) {
    try {
      return await playWavBase64(opts.audioWavBase64, opts);
    } catch {
      /* fall through to browser */
    }
  }

  return speakWithBrowser(trimmed, opts);
}

export function stopPersonaSpeech(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/** @deprecated use playPersonaSpeech */
export const speakSofia = playPersonaSpeech;
export const stopSofiaSpeech = stopPersonaSpeech;
