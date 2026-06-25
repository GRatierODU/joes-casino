/** Gemini TTS inline tags like [laughs] — strip for on-screen chat bubbles. */
export function stripAudioTags(text: string): string {
  return text
    .replace(/\[[^\]]+\]\s*/g, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Build a Gemini TTS director prompt (audio tags + scene context). */
export function buildKaceyTtsPrompt(transcript: string, voiceName: string): string {
  return `Synthesize speech only. Do not read the directions aloud.

# AUDIO PROFILE: Kacey
## "ODU Greek Life Flirt"

## THE SCENE: Joe's Casino VIP Lounge
Late night. A home poker game — folding tables, low light, chips and banter. Kacey is 20, Alpha Phi, crashed the Sig Ep game again. She's joking, flirty, a little chaotic. Casual American English.

### DIRECTOR'S NOTES
Style:
* Young, conversational, like she's talking across the poker table — not reading a script.
* Natural breath and pacing; slight smile in the voice when teasing.
* Laughs and sighs only when the transcript tags ask for them.

Pace: Relaxed lounge tempo. Speed up slightly when excited; slow down for a teasing beat.

Voice: Use the "${voiceName}" prebuilt voice.

Accent: General American, college-aged.

#### TRANSCRIPT
${transcript}`;
}
