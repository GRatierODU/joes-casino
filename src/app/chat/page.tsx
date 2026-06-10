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
  type ChatMood,
  type ChatPersonaId,
} from "@/lib/chatPersonas";
import { playPersonaSpeech, stopPersonaSpeech } from "@/lib/sofiaSpeech";

const CHAT_GATE_STORAGE = "joes-chat-gate";
const CHAT_GATE_PASSWORD = "joescasino";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatApiResponse = {
  reply?: string;
  audioBase64?: string | null;
  audioMime?: string | null;
  interest?: number;
  mood?: ChatMood;
  won?: boolean;
  lost?: boolean;
  error?: string;
};

export default function ChatPage() {
  const [gateReady, setGateReady] = useState(false);
  const [chatUnlocked, setChatUnlocked] = useState(false);
  const [gatePw, setGatePw] = useState("");
  const [gateError, setGateError] = useState("");

  const [personaId, setPersonaId] = useState<ChatPersonaId | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [interest, setInterest] = useState(0);
  const [mood, setMood] = useState<ChatMood>("curious");
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [bootstrapping, setBootstrapping] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);
  const cancelSpeechRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    try {
      setChatUnlocked(sessionStorage.getItem(CHAT_GATE_STORAGE) === "1");
    } catch {
      setChatUnlocked(false);
    }
    setGateReady(true);
  }, []);

  useEffect(() => {
    return () => {
      cancelSpeechRef.current?.();
      stopPersonaSpeech();
    };
  }, []);

  const applyAssistantTurn = useCallback(
    async (data: ChatApiResponse, id: ChatPersonaId, append: boolean) => {
      if (!data.reply) return;

      cancelSpeechRef.current?.();
      if (append) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply! }]);
      } else {
        setMessages([{ role: "assistant", content: data.reply }]);
      }
      if (typeof data.interest === "number") setInterest(data.interest);
      if (data.mood) setMood(data.mood);
      if (data.won) setWon(true);
      if (data.lost) setLost(true);

      cancelSpeechRef.current = await playPersonaSpeech(data.reply, {
        audioBase64: data.audioBase64,
        audioMime: data.audioMime,
        personaId: id,
        onStart: () => setSpeaking(true),
        onEnd: () => setSpeaking(false),
      });
    },
    []
  );

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const handleGateSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = gatePw.trim();
    if (v === CHAT_GATE_PASSWORD) {
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
      const persona = CHAT_PERSONAS[id];
      setPersonaId(id);
      setMessages([]);
      setInterest(persona.startInterest);
      setMood("curious");
      setWon(false);
      setLost(false);
      setError("");
      setBootstrapping(true);
      setLoading(true);

      const data = await callChat({
        personaId: id,
        interest: persona.startInterest,
        messages: [],
        opening: true,
      });

      if (!data?.reply) {
        setLoading(false);
        setBootstrapping(false);
        return;
      }

      await applyAssistantTurn(data, id, false);
      setLoading(false);
      setBootstrapping(false);
    },
    [callChat, applyAssistantTurn]
  );

  const sendUserMessage = async () => {
    const text = input.trim();
    if (!text || !personaId || loading || won || lost) return;

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

    if (!data?.reply) {
      setLoading(false);
      return;
    }

    await applyAssistantTurn(data, personaId, true);
    setLoading(false);
  };

  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendUserMessage();
    }
  };

  const backToPicker = () => {
    if (loading || bootstrapping) return;
    cancelSpeechRef.current?.();
    stopPersonaSpeech();
    setSpeaking(false);
    setPersonaId(null);
    setMessages([]);
    setInterest(0);
    setMood("curious");
    setWon(false);
    setLost(false);
    setError("");
    setInput("");
  };

  const showGateOverlay = !gateReady || !chatUnlocked;
  const pageInteractive = gateReady && chatUnlocked;
  const persona = personaId ? CHAT_PERSONAS[personaId] : null;

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
          <div className="chat-title-row">
            {personaId ? (
              <button
                type="button"
                className="chat-back-btn"
                onClick={backToPicker}
                disabled={loading || bootstrapping}
                aria-label="Back to character list"
              >
                &larr;
              </button>
            ) : (
              <span className="chat-back-spacer" aria-hidden="true" />
            )}
            <h1 className="chat-title">{persona?.name ?? "VIP Lounge"}</h1>
            <span className="chat-back-spacer" aria-hidden="true" />
          </div>
          {!personaId ? (
            <p className="chat-sub">Pick who you want to take home tonight.</p>
          ) : null}
        </header>

        {!personaId ? (
          <main className="chat-picker">
            <p className="chat-picker-lead">Who are you talking to?</p>
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
                        sizes="120px"
                        className="chat-persona-thumb-img"
                      />
                    </span>
                    <span className="chat-persona-label">{p.name}</span>
                    <span className="chat-persona-diff">{p.label}</span>
                    <span className="chat-persona-tag">{p.tagline}</span>
                  </button>
                );
              })}
            </div>
          </main>
        ) : (
          <main className="chat-main">
            <div className="chat-layout">
              <aside className="chat-avatar-panel">
                <div
                  className={`chat-avatar-photo${speaking || loading ? " chat-avatar-photo--speaking" : ""} chat-avatar-photo--${mood}`}
                >
                  <Image
                    src={persona?.portrait ?? "/chat/sofia-portrait.jpg"}
                    alt={`${persona?.name ?? "Sofia"} in the VIP lounge`}
                    fill
                    sizes="(max-width: 900px) 100vw, 340px"
                    className="chat-avatar-photo-img"
                    priority
                  />
                  <div className="chat-avatar-photo-vignette" aria-hidden="true" />
                </div>
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
                  <p className="chat-banner chat-banner--win">
                    She&apos;s coming home with you. You win.
                  </p>
                ) : lost ? (
                  <p className="chat-banner chat-banner--lose">
                    She&apos;s not going home with you tonight.
                  </p>
                ) : null}
              </aside>

              <section className="chat-panel">
                <div className="chat-thread" ref={threadRef}>
                  {messages.map((m, i) => (
                    <div
                      key={`${i}-${m.role}`}
                      className={`chat-bubble chat-bubble--${m.role}`}
                    >
                      {m.content}
                    </div>
                  ))}
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
                    placeholder={
                      won
                        ? "She said yes — keep the night going…"
                        : lost
                          ? "She shut it down for tonight…"
                          : "Flirt. Build tension. Close the deal…"
                    }
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
        )}
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
