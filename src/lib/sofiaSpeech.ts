import { CHAT_PERSONAS, type ChatPersonaId } from "./chatPersonas";

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

function pickPersonaVoice(
  voices: SpeechSynthesisVoice[],
  personaId?: ChatPersonaId | null
): SpeechSynthesisVoice | undefined {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const persona = personaId ? CHAT_PERSONAS[personaId] : null;
  if (persona?.browserVoiceHint) {
    const hint = new RegExp(persona.browserVoiceHint, "i");
    const match = en.find((v) => hint.test(v.name));
    if (match) return match;
  }
  const prefer =
    /zira|samantha|victoria|jenny|aria|susan|karen|moira|tessa|female|natasha/i;
  return en.find((v) => prefer.test(v.name)) ?? en[0] ?? voices[0];
}

function speakWithBrowser(
  text: string,
  opts: PlayPersonaSpeechOptions
): Promise<() => void> {
  return loadVoices().then((voices) => {
    if (!window.speechSynthesis) {
      opts.onEnd?.();
      return () => {};
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickPersonaVoice(voices, opts.personaId);
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

function playAudioBase64(
  base64: string,
  mime: string,
  opts: PlayPersonaSpeechOptions
): Promise<() => void> {
  return new Promise((resolve, reject) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
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

/** Play pre-generated audio (from chat API) or fall back to browser TTS. */
export async function playPersonaSpeech(
  text: string,
  opts: PlayPersonaSpeechOptions & {
    audioBase64?: string | null;
    audioMime?: string | null;
    /** @deprecated use audioBase64 */
    audioWavBase64?: string | null;
  } = {}
): Promise<() => void> {
  const trimmed = text.trim();
  if (!trimmed) {
    opts.onEnd?.();
    return () => {};
  }

  stopPersonaSpeech();

  const base64 = opts.audioBase64 ?? opts.audioWavBase64;
  const mime = opts.audioMime ?? (opts.audioWavBase64 ? "audio/wav" : null);

  if (base64 && mime) {
    try {
      return await playAudioBase64(base64, mime, opts);
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
