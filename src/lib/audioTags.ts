import type { ChatPersonaId } from "./chatPersonas";

/** Gemini TTS inline tags like [laughs] — strip for on-screen chat bubbles. */
export function stripAudioTags(text: string): string {
  return text
    .replace(/\[[^\]]+\]\s*/g, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildKaceyTtsPrompt(transcript: string, voiceName: string): string {
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

function buildBetterJoeTtsPrompt(transcript: string, voiceName: string): string {
  return `Synthesize speech only. Do not read the directions aloud.

# AUDIO PROFILE: Better Joe
## "Sig Ep Poker Host Trash Talk"

## THE SCENE: Joe's Casino VIP Lounge
Late night. Better Joe is 20, Sigma Phi Epsilon, hosting a home poker game at the head of the table. Aviators, gold chains, smug confidence. He plays loose, wins anyway, and talks shit the whole time. Casual American English, frat-house energy.

### DIRECTOR'S NOTES
Style:
* Young male, cocky and conversational — like he's talking across the felt mid-hand, not reading a script.
* Smirk in the voice when trash-talking or bragging about a hand.
* Laughs and scoffs only when the transcript tags ask for them.

Pace: Relaxed but punchy. Speed up when excited about a pot or a bluff; slow down for a deliberate smug beat.

Voice: Use the "${voiceName}" prebuilt voice.

Accent: General American, college-aged.

#### TRANSCRIPT
${transcript}`;
}

function buildYoshuaTtsPrompt(transcript: string, voiceName: string): string {
  return `Synthesize speech only. Do not read the directions aloud.

# AUDIO PROFILE: Yoshua
## "Sig Ep Gym Tight Player"

## THE SCENE: Joe's Casino VIP Lounge
Late night poker. Yoshua (Joshua) is 22, Sigma Phi Epsilon — disciplined, gym-focused, dry and judgmental. He has an accent: word-initial J → Y (Yosh, Yoe), and name spellings like Benjamin → Benyamin — that's the most extreme it gets. Casual American English.

### DIRECTOR'S NOTES
Style:
* Young male, measured and confident — not trash-talk loud like Joe; more dry and smug.
* Matter-of-fact when talking gym, money, or cleanliness.
* Sighs and scoffs only when transcript tags ask for them.

Pace: Even, controlled. Brief pauses when he's unimpressed.

Voice: Use the "${voiceName}" prebuilt voice.

Accent: General American, early twenties.

#### TRANSCRIPT
${transcript}`;
}

/** Build a Gemini TTS director prompt (audio tags + scene context) for a persona. */
export function buildPersonaTtsPrompt(
  personaId: ChatPersonaId | undefined,
  transcript: string,
  voiceName: string
): string {
  if (personaId === "better-joe") {
    return buildBetterJoeTtsPrompt(transcript, voiceName);
  }
  if (personaId === "yoshua") {
    return buildYoshuaTtsPrompt(transcript, voiceName);
  }
  return buildKaceyTtsPrompt(transcript, voiceName);
}
