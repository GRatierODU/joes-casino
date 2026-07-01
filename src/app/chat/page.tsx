"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  CHAT_PERSONAS,
  clampInterest,
  moodLabel,
  verdictLabel,
  type ChatMood,
  type ChatPersona,
  type ChatPersonaId,
  type CoachVerdict,
} from "@/lib/chatPersonas";
import { stripAudioTags } from "@/lib/audioTags";
import { speakSofia, stopSofiaSpeech } from "@/lib/sofiaSpeech";

const CHAT_GATE_STORAGE = "joes-chat-gate";
const CHAT_GATE_PASSWORDS = ["joescasino", "viplounge"];

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatApiResponse = {
  reply?: string;
  interest?: number;
  mood?: ChatMood;
  verdict?: CoachVerdict;
  won?: boolean;
  lost?: boolean;
  error?: string;
};

function winBanner(persona: ChatPersona): string {
  return persona.subjectPronoun === "he"
    ? "He said he'd leave with you tonight."
    : "She said she'd leave with you tonight.";
}

function loseBanner(persona: ChatPersona): string {
  return persona.subjectPronoun === "he"
    ? "He's not going home with you tonight."
    : "She's not going home with you tonight.";
}

export default function ChatPage() {
  const [gateReady, setGateReady] = useState(false);
  const [chatUnlocked, setChatUnlocked] = useState(false);
  const [gatePw, setGatePw] = useState("");
  const [gateError, setGateError] = useState("");

  const [personaId, setPersonaId] = useState<ChatPersonaId | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [interest, setInterest] = useState(0);
  const [mood, setMood] = useState<ChatMood>("curious");
  const [verdict, setVerdict] = useState<CoachVerdict | null>(null);
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakingReveal, setSpeakingReveal] = useState<{
    messageIndex: number;
    text: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [bootstrapping, setBootstrapping] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);
  const cancelSpeechRef = useRef<(() => void) | null>(null);
  const personaIdRef = useRef<ChatPersonaId | null>(null);
  const sessionGenRef = useRef(0);

  const persona = personaId ? CHAT_PERSONAS[personaId] : null;
  const isCoach = persona?.mode === "coach";

  useEffect(() => {
    personaIdRef.current = personaId;
  }, [personaId]);

  useEffect(() => {
    try {
      setChatUnlocked(sessionStorage.getItem(CHAT_GATE_STORAGE) === "1");
    } catch {
      setChatUnlocked(false);
    }
    setGateReady(true);
  }, []);

  const resetSession = useCallback(() => {
    sessionGenRef.current += 1;
    cancelSpeechRef.current?.();
    cancelSpeechRef.current = null;
    stopSofiaSpeech();
    setSpeaking(false);
    setSpeakingReveal(null);
  }, []);

  useEffect(() => {
    return () => resetSession();
  }, [resetSession]);

  const playPersonaLine = useCallback(
    async (line: string, messageIndex: number, id: ChatPersonaId) => {
      const p = CHAT_PERSONAS[id];
      if (!p.ttsEnabled) return;

      cancelSpeechRef.current?.();
      setSpeakingReveal({ messageIndex, text: "" });
      cancelSpeechRef.current = await speakSofia(line, {
        personaId: id,
        onStart: () => setSpeaking(true),
        onReveal: (text) => setSpeakingReveal({ messageIndex, text }),
        onEnd: () => {
          setSpeaking(false);
          setSpeakingReveal(null);
        },
      });
    },
    []
  );

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading, speakingReveal]);

  const handleGateSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = gatePw.trim().toLowerCase();
    if (CHAT_GATE_PASSWORDS.includes(v)) {
      try {
        sessionStorage.setItem(CHAT_GATE_STORAGE, "1");
      } catch {
        /* ignore */
      }
      setChatUnlocked(true);
      setGateError("");
      setGatePw("");
    } else {
      setGateError("Wrong password.");
    }
  };

  const callChat = useCallback(
    async (payload: {
      personaId: ChatPersonaId;
      interest: number;
      messages: ChatMessage[];
      opening?: boolean;
    }): Promise<ChatApiResponse | null> => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as ChatApiResponse;
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return null;
      }
      return data;
    },
    []
  );

  const startPersona = useCallback(
    async (id: ChatPersonaId) => {
      const gen = sessionGenRef.current;
      const p = CHAT_PERSONAS[id];

      resetSession();
      setPersonaId(id);
      setMessages([]);
      setInterest(p.startInterest);
      setMood("curious");
      setVerdict(null);
      setWon(false);
      setLost(false);
      setError("");

      if (p.mode === "coach") return;

      setBootstrapping(true);
      setLoading(true);

      const data = await callChat({
        personaId: id,
        interest: p.startInterest,
        messages: [],
        opening: true,
      });

      if (gen !== sessionGenRef.current) return;

      setLoading(false);
      setBootstrapping(false);

      if (!data?.reply) return;

      setMessages([{ role: "assistant", content: stripAudioTags(data.reply) }]);
      if (typeof data.interest === "number") setInterest(data.interest);
      if (data.mood) setMood(data.mood);
      if (data.won) setWon(true);
      if (data.lost) setLost(true);
      void playPersonaLine(data.reply, 0, id);
    },
    [callChat, playPersonaLine, resetSession]
  );

  const backToPicker = () => {
    resetSession();
    setPersonaId(null);
    setMessages([]);
    setError("");
    setBootstrapping(false);
    setLoading(false);
  };

  const sendUserMessage = async () => {
    const text = input.trim();
    if (!text || !personaId || loading || (!isCoach && lost)) return;

    const gen = sessionGenRef.current;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    const data = await callChat({
      personaId,
      interest,
      messages: nextMessages,
    });

    if (gen !== sessionGenRef.current) return;

    setLoading(false);

    if (!data?.reply) return;

    const assistantIndex = nextMessages.length;
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: stripAudioTags(data.reply!) },
    ]);
    if (typeof data.interest === "number") setInterest(data.interest);
    if (data.mood) setMood(data.mood);
    if (data.verdict) setVerdict(data.verdict);
    if (data.won) setWon(true);
    if (data.lost) setLost(true);

    if (persona?.ttsEnabled !== false) {
      void playPersonaLine(data.reply, assistantIndex, personaId);
    }
  };

  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendUserMessage();
    }
  };

  const showGateOverlay = !gateReady || !chatUnlocked;
  const pageInteractive = gateReady && chatUnlocked;
  const showPicker = pageInteractive && !personaId;

  return (
    <>
      <div
        className={`chat-page${!pageInteractive ? " chat-page--behind-gate" : ""}`}
        aria-hidden={!pageInteractive}
      >
        <div className="tables-suits chat-suits" aria-hidden="true">
          <span className="suit suit-1">&spades;</span>
          <span className="suit suit-2">&hearts;</span>
          <span className="suit suit-3">&diams;</span>
          <span className="suit suit-4">&clubs;</span>
        </div>

        <nav className="tables-nav">
          <Link href="/" className="tables-nav-link">
            &larr; Leaderboard
          </Link>
          <Link href="/tables" className="tables-nav-link">
            Live Tables
          </Link>
          <Link href="/bad-beats" className="tables-nav-link">
            Bad Beats
          </Link>
        </nav>

        <header className="chat-header">
          <p className="chat-eyebrow">Joe&apos;s Casino · VIP Lounge</p>
          <h1 className="chat-title">
            {showPicker ? "Who do you want to talk to?" : persona?.name}
          </h1>
        </header>

        {showPicker ? (
          <main className="chat-picker">
            <div className="chat-persona-grid">
              {(Object.keys(CHAT_PERSONAS) as ChatPersonaId[]).map((id) => {
                const p = CHAT_PERSONAS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    className="chat-persona-card"
                    disabled={bootstrapping}
                    onClick={() => void startPersona(id)}
                  >
                    <span className="chat-persona-thumb">
                      <Image
                        src={p.portrait}
                        alt={p.name}
                        fill
                        sizes="200px"
                        className="chat-persona-thumb-img"
                        priority
                      />
                    </span>
                    <span className="chat-persona-label">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </main>
        ) : persona ? (
          <main className="chat-main">
            <div className="chat-layout">
              <aside className="chat-avatar-panel">
                <button type="button" className="chat-back-picker" onClick={backToPicker}>
                  &larr; Switch
                </button>
                <div
                  className={`chat-avatar-photo${
                    !isCoach && (speaking || loading) ? " chat-avatar-photo--speaking" : ""
                  }${
                    !isCoach
                      ? ` chat-avatar-photo--${mood}`
                      : verdict
                        ? ` chat-avatar-photo--verdict-${verdict}`
                        : ""
                  }`}
                >
                  <Image
                    src={persona.portrait}
                    alt={persona.name}
                    fill
                    sizes="(max-width: 900px) 100vw, 340px"
                    className={`chat-avatar-photo-img${
                      personaId === "dan" ? " chat-avatar-photo-img--dan" : ""
                    }${personaId === "better-joe" ? " chat-avatar-photo-img--better-joe" : ""}`}
                    priority
                  />
                  <div className="chat-avatar-photo-vignette" aria-hidden="true" />
                </div>
                {isCoach ? (
                  <div className="chat-meter chat-meter--verdict">
                    <div className="chat-meter-head">
                      <span>Verdict</span>
                    </div>
                    <p className={`chat-verdict chat-verdict--${verdict ?? "marginal"}`}>
                      {verdict ? verdictLabel(verdict) : "\u00a0"}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="chat-meter">
                      <div className="chat-meter-head">
                        <span>Attraction</span>
                        <span>{clampInterest(interest)}%</span>
                      </div>
                      <div className="chat-meter-track" aria-hidden="true">
                        <div
                          className="chat-meter-fill"
                          style={{ width: `${clampInterest(interest)}%` }}
                        />
                      </div>
                      <p className="chat-mood">{moodLabel(mood)}</p>
                    </div>
                    {won ? (
                      <p className="chat-banner chat-banner--win">{winBanner(persona)}</p>
                    ) : lost ? (
                      <p className="chat-banner chat-banner--lose">{loseBanner(persona)}</p>
                    ) : null}
                  </>
                )}
              </aside>

              <section className="chat-panel">
                <div className="chat-thread" ref={threadRef}>
                  {messages.map((m, i) => {
                    const isRevealing =
                      m.role === "assistant" && speakingReveal?.messageIndex === i;
                    const displayText = isRevealing ? speakingReveal.text : m.content;
                    const showCursor = isRevealing && speaking;

                    return (
                      <div
                        key={`${i}-${m.role}`}
                        className={`chat-bubble chat-bubble--${m.role}${showCursor ? " chat-bubble--revealing" : ""}`}
                      >
                        {displayText}
                        {showCursor ? (
                          <span className="chat-reveal-cursor" aria-hidden="true" />
                        ) : null}
                      </div>
                    );
                  })}
                  {loading ? (
                    <div className="chat-bubble chat-bubble--assistant chat-bubble--typing">
                      …
                    </div>
                  ) : null}
                </div>

                {error ? <p className="chat-error">{error}</p> : null}

                <div className="chat-composer">
                  <textarea
                    className="chat-input"
                    rows={2}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onComposerKeyDown}
                    disabled={loading || bootstrapping}
                  />
                  <button
                    type="button"
                    className="modal-btn modal-btn-submit chat-send"
                    disabled={loading || bootstrapping || !input.trim()}
                    onClick={() => void sendUserMessage()}
                  >
                    Send
                  </button>
                </div>
              </section>
            </div>
          </main>
        ) : null}
      </div>

      {showGateOverlay ? (
        <div className="tables-gate-overlay" role="presentation">
          {!gateReady ? (
            <p className="tables-gate-loading">Loading…</p>
          ) : (
            <form
              className="modal-card tables-gate-card"
              onSubmit={handleGateSubmit}
              autoComplete="off"
            >
              <h2 className="modal-title">VIP Lounge</h2>
              <p className="tables-gate-hint">Enter the password to open the lounge chat.</p>
              <label className="modal-label">
                Password
                <input
                  className="modal-input"
                  type="password"
                  name="chat-gate-password"
                  autoComplete="current-password"
                  autoFocus
                  value={gatePw}
                  onChange={(e) => {
                    setGatePw(e.target.value);
                    setGateError("");
                  }}
                  placeholder="Password"
                />
              </label>
              {gateError ? <p className="tables-gate-error">{gateError}</p> : null}
              <button type="submit" className="modal-btn modal-btn-submit">
                Continue
              </button>
            </form>
          )}
        </div>
      ) : null}
    </>
  );
}
