"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type TournamentSeat = { name: string } | null;

type TournamentState = {
  started: boolean;
  buyin: number;
  tables: [TournamentSeat[], TournamentSeat[]];
  blindLevel: number;
  blindStartedAt: number;
  paused: boolean;
  pausedRemaining: number;
  busted: { name: string; placement: number }[];
  registeredCount: number;
  createdAt: string;
};

type TournamentResult = {
  date: string;
  buyin: number;
  players: { name: string; placement: number }[];
  totalPot: number;
};

const BLIND_LEVELS: [number, number][] = [
  [1, 2], [2, 4], [3, 6], [5, 10], [10, 20],
  [15, 30], [20, 40], [25, 50], [50, 100],
  [75, 150], [100, 200], [150, 300], [200, 400],
];
const BLIND_DURATION = 15 * 60;

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ordSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

type ModalState =
  | { kind: "create" }
  | { kind: "register"; table: number; seat: number }
  | { kind: "player-reg"; table: number; seat: number; name: string }
  | { kind: "player"; table: number; seat: number; name: string }
  | { kind: "move"; table: number; seat: number; name: string }
  | { kind: "bust-confirm"; table: number; seat: number; name: string }
  | { kind: "cancel-confirm" }
  | null;

export default function TournamentsPage() {
  const [state, setState] = useState<TournamentState | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [formName, setFormName] = useState("");
  const [formBuyin, setFormBuyin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(BLIND_DURATION);
  const [finished, setFinished] = useState<TournamentResult | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<TournamentResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [blindsOpen, setBlindsOpen] = useState(false);

  const [players, setPlayers] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/players")
      .then((r) => r.json())
      .then((d) => setPlayers(d.players ?? []))
      .catch(() => {});
  }, []);

  const fetchState = useCallback(() => {
    fetch("/api/tournaments")
      .then((r) => r.json())
      .then((d) => setState(d.state))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, 5000);
    return () => clearInterval(id);
  }, [fetchState]);

  useEffect(() => {
    if (!state?.started || state.paused) {
      if (state?.paused) setTimeLeft(state.pausedRemaining);
      return;
    }
    const tick = () => {
      const elapsed = (Date.now() - state.blindStartedAt) / 1000;
      setTimeLeft(Math.max(0, BLIND_DURATION - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state?.started, state?.blindStartedAt, state?.paused, state?.pausedRemaining, state?.blindLevel]);

  const activePlayers = state ? state.tables.flat().filter((s) => s !== null).length : 0;
  const blindIdx = state ? Math.min(state.blindLevel, BLIND_LEVELS.length - 1) : 0;
  const currentBlinds = BLIND_LEVELS[blindIdx];
  const nextBlinds = blindIdx < BLIND_LEVELS.length - 1 ? BLIND_LEVELS[blindIdx + 1] : null;

  const handleCreate = useCallback(async () => {
    setError("");
    const buyin = parseFloat(formBuyin);
    if (isNaN(buyin) || buyin <= 0) { setError("Enter a valid buy-in amount."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", buyin }),
      });
      if (res.ok) { setState((await res.json()).state); setModal(null); }
      else { const d = await res.json(); setError(d.error || "Failed."); }
    } catch { setError("Network error."); }
    setSubmitting(false);
  }, [formBuyin]);

  const handleRegister = useCallback(async () => {
    if (!modal || modal.kind !== "register") return;
    setError("");
    if (!formName.trim()) { setError("Enter a name."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", table: modal.table, seat: modal.seat, name: formName.trim() }),
      });
      if (res.ok) { setState((await res.json()).state); setModal(null); }
      else { const d = await res.json(); setError(d.error || "Failed."); }
    } catch { setError("Network error."); }
    setSubmitting(false);
  }, [modal, formName]);

  const handleUnregister = useCallback(async (table: number, seat: number) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unregister", table, seat }),
      });
      if (res.ok) { setState((await res.json()).state); setModal(null); }
    } catch {}
    setSubmitting(false);
  }, []);

  const handleStart = useCallback(async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (res.ok) { setState((await res.json()).state); }
      else { const d = await res.json(); setError(d.error || "Failed."); }
    } catch {}
    setSubmitting(false);
  }, []);

  const handleBust = useCallback(async (table: number, seat: number) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bust", table, seat }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.finished) { setState(null); setFinished(data.result); }
        else setState(data.state);
        setModal(null);
      }
    } catch {}
    setSubmitting(false);
  }, []);

  const handlePause = useCallback(async () => {
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
      if (res.ok) setState((await res.json()).state);
    } catch {}
  }, []);

  const handleCancel = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (res.ok) { setState(null); setModal(null); }
    } catch {}
    setSubmitting(false);
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/tournaments?history=true");
      const data = await res.json();
      setHistory(data.history ?? []);
    } catch {}
  }, []);

  const deleteHistory = useCallback(async (idx: number) => {
    try {
      const res = await fetch("/api/tournaments", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: idx }),
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history ?? []);
        setSelectedIdx(null);
      }
    } catch {}
  }, []);

  return (
    <div className="tables-page">
      <div className="tables-suits" aria-hidden="true">
        <span className="suit suit-1">&spades;</span>
        <span className="suit suit-2">&hearts;</span>
        <span className="suit suit-3">&diams;</span>
        <span className="suit suit-4">&clubs;</span>
        <span className="suit suit-5">&hearts;</span>
        <span className="suit suit-6">&spades;</span>
      </div>

      <nav className="tables-nav">
        <Link href="/" className="tables-nav-link">&larr; Leaderboard</Link>
        <Link href="/tables" className="tables-nav-link">Live Tables</Link>
        <Link href="/stats" className="tables-nav-link">Stats</Link>
      </nav>

      <header className="tables-header">
        {state ? (
          <>
            <div className={`status-badge ${state.started ? "status-open" : "status-registering"}`}>
              <span className="status-dot" />
              {state.started ? "LIVE" : "REGISTERING"}
            </div>
            <h1 className="tables-title">Tournament</h1>
            <p className="tables-sub">
              {state.started
                ? `${activePlayers} player${activePlayers !== 1 ? "s" : ""} remaining`
                : `${state.registeredCount} player${state.registeredCount !== 1 ? "s" : ""} registered`}
            </p>
            <p className="tables-in-play">
              Buy-in: ${state.buyin} &middot; Pot: ${(state.buyin * state.registeredCount).toLocaleString("en-US")}
            </p>

            <div className="tourney-controls">
              {state.started ? (
                <>
                  <button className="tourney-ctrl-btn" onClick={handlePause}>
                    {state.paused ? "\u25B6 Resume" : "\u23F8 Pause"}
                  </button>
                  <button className="tourney-ctrl-btn" onClick={() => setBlindsOpen(true)}>Blinds</button>
                  <button className="tourney-ctrl-btn tourney-ctrl-cancel" onClick={() => setModal({ kind: "cancel-confirm" })}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="tourney-ctrl-btn tourney-ctrl-start"
                    onClick={handleStart}
                    disabled={state.registeredCount < 2 || submitting}
                  >
                    Start Tournament
                  </button>
                  <button className="tourney-ctrl-btn" onClick={() => setBlindsOpen(true)}>Blinds</button>
                  <button className="tourney-ctrl-btn tourney-ctrl-cancel" onClick={() => setModal({ kind: "cancel-confirm" })}>
                    Cancel
                  </button>
                </>
              )}
            </div>
            {error && <p style={{ color: "#ef4444", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}
          </>
        ) : (
          <>
            <h1 className="tables-title">Tournaments</h1>
            <p className="tables-sub">No active tournament</p>
            <div className="tourney-controls">
              <button
                className="tourney-ctrl-btn tourney-ctrl-start"
                onClick={() => { setFormBuyin(""); setError(""); setModal({ kind: "create" }); }}
              >
                Create Tournament
              </button>
            </div>
          </>
        )}
        <button
          className="history-btn"
          onClick={() => { setHistoryOpen(true); setSelectedIdx(null); fetchHistory(); }}
        >
          Tournament History
        </button>
      </header>

      {state && (
        <div className="tables-grid">
          {state.tables.map((seats, ti) => (
            <div key={ti} className="poker-table-wrap">
              <h2 className="table-label">Table {ti + 1}</h2>
              <div className="poker-table">
                <div className="felt">
                  {state.started ? (
                    <div className="felt-blinds">
                      <span className="felt-level">Level {state.blindLevel + 1}</span>
                      <span className="felt-blind-value">{currentBlinds[0]} / {currentBlinds[1]}</span>
                      <span className={`felt-timer ${timeLeft < 60 ? "felt-timer-warning" : ""} ${state.paused ? "felt-timer-paused" : ""}`}>
                        {state.paused ? "PAUSED" : fmtTime(timeLeft)}
                      </span>
                      {nextBlinds && <span className="felt-next">Next: {nextBlinds[0]}/{nextBlinds[1]}</span>}
                    </div>
                  ) : (
                    <span className="felt-text">Joe&apos;s Casino</span>
                  )}
                </div>
                {seats.map((s, si) => (
                  <button
                    key={si}
                    className={`seat seat-${si} ${s ? "seat-occupied" : "seat-empty"} ${state.started && !s ? "seat-dead" : ""}`}
                    onClick={() => {
                      if (s) {
                        if (state.started) setModal({ kind: "player", table: ti, seat: si, name: s.name });
                        else setModal({ kind: "player-reg", table: ti, seat: si, name: s.name });
                      } else if (!state.started) {
                        setFormName(""); setError("");
                        setModal({ kind: "register", table: ti, seat: si });
                      }
                    }}
                  >
                    <span className="seat-number">{si + 1}</span>
                    {s ? (
                      <div className="seat-info">
                        <span className="seat-name">{s.name}</span>
                      </div>
                    ) : (
                      <span className="seat-open-label">{state.started ? "" : "Open"}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {state?.started && state.busted.length > 0 && (
        <div className="tourney-busted">
          <h3 className="tourney-busted-title">Eliminated</h3>
          <div className="tourney-busted-list">
            {[...state.busted].reverse().map((p, i) => (
              <div key={i} className="tourney-busted-row">
                <span className="tourney-busted-place">{p.placement}{ordSuffix(p.placement)}</span>
                <span className="tourney-busted-name">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───── CREATE TOURNAMENT MODAL ───── */}
      {modal?.kind === "create" && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Create Tournament</h3>
            <label className="modal-label">
              Buy-in ($)
              <input
                className="modal-input" type="number" placeholder="e.g. 20" min="1"
                value={formBuyin} onChange={(e) => setFormBuyin(e.target.value)}
              />
            </label>
            {error && <p style={{ color: "#ef4444", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="modal-btn modal-btn-submit" onClick={handleCreate} disabled={submitting}>
                {submitting ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── REGISTER PLAYER MODAL ───── */}
      {modal?.kind === "register" && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Register &mdash; Table {modal.table + 1}, Seat {modal.seat + 1}</h3>
            <label className="modal-label">
              Player
              <select
                className="modal-input modal-select"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              >
                <option value="">Select a player</option>
                {players.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            {error && <p style={{ color: "#ef4444", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="modal-btn modal-btn-submit" onClick={handleRegister} disabled={submitting}>
                {submitting ? "Registering..." : "Register"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── REGISTERED PLAYER OPTIONS ───── */}
      {modal?.kind === "player-reg" && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{modal.name}</h3>
            <p className="player-modal-buyin">Registered for tournament</p>
            <div className="player-modal-options">
              <button
                className="player-option-btn player-option-move"
                style={{ flex: 1 }}
                onClick={() => { setError(""); setModal({ kind: "move", table: modal.table, seat: modal.seat, name: modal.name }); }}
              >
                Move Seat
              </button>
              <button
                className="player-option-btn player-option-cashout"
                style={{ flex: 1 }}
                onClick={() => handleUnregister(modal.table, modal.seat)}
                disabled={submitting}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── PLAYING PLAYER OPTIONS ───── */}
      {modal?.kind === "player" && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{modal.name}</h3>
            <p className="player-modal-buyin">Table {modal.table + 1}, Seat {modal.seat + 1}</p>
            <div className="player-modal-options">
              <button
                className="player-option-btn player-option-cashout"
                onClick={() => setModal({ kind: "bust-confirm", table: modal.table, seat: modal.seat, name: modal.name })}
              >
                Bust Out
              </button>
            </div>
            <button
              className="player-option-btn player-option-move"
              onClick={() => { setError(""); setModal({ kind: "move", table: modal.table, seat: modal.seat, name: modal.name }); }}
            >
              Move Seat
            </button>
          </div>
        </div>
      )}

      {/* ───── BUST CONFIRMATION ───── */}
      {modal?.kind === "bust-confirm" && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-card confirm-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Bust Out?</h3>
            <p className="player-modal-buyin">
              <strong>{modal.name}</strong> will be eliminated
              ({state ? state.registeredCount - state.busted.length : "?"}
              {ordSuffix(state ? state.registeredCount - state.busted.length : 0)} place)
            </p>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button
                className="modal-btn modal-btn-delete"
                onClick={() => handleBust(modal.table, modal.seat)}
                disabled={submitting}
              >
                {submitting ? "Busting..." : "Confirm Bust"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── MOVE SEAT MODAL ───── */}
      {modal?.kind === "move" && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Move {modal.name}</h3>
            <p className="player-modal-buyin" style={{ marginBottom: "0.5rem" }}>
              Currently: Table {modal.table + 1}, Seat {modal.seat + 1}
            </p>
            {state?.tables.map((seats, ti) => {
              const emptySeats = seats
                .map((s, si) => ({ s, si }))
                .filter(({ s, si }) => s === null && !(ti === modal.table && si === modal.seat));
              if (emptySeats.length === 0) return null;
              return (
                <div key={ti} className="move-table-group">
                  <p className="move-table-label">Table {ti + 1}</p>
                  <div className="move-seat-grid">
                    {emptySeats.map(({ si }) => (
                      <button
                        key={si} className="move-seat-btn" disabled={submitting}
                        onClick={async () => {
                          setSubmitting(true);
                          try {
                            const res = await fetch("/api/tournaments", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "move", table: modal.table, seat: modal.seat, toTable: ti, toSeat: si }),
                            });
                            if (res.ok) { setState((await res.json()).state); setModal(null); }
                          } catch {}
                          setSubmitting(false);
                        }}
                      >
                        Seat {si + 1}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <button className="modal-btn modal-btn-cancel" style={{ marginTop: "0.5rem" }} onClick={() => setModal(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ───── CANCEL CONFIRMATION ───── */}
      {modal?.kind === "cancel-confirm" && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-card confirm-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Cancel Tournament?</h3>
            <p className="player-modal-buyin">This will discard the tournament. Results will not be saved.</p>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setModal(null)}>Go Back</button>
              <button className="modal-btn modal-btn-delete" onClick={handleCancel} disabled={submitting}>
                {submitting ? "Cancelling..." : "Cancel Tournament"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── TOURNAMENT FINISHED ───── */}
      {finished && (() => {
        const winner = finished.players.find((p) => p.placement === 1);
        return (
          <div className="modal-backdrop" onClick={() => setFinished(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-title" style={{ textAlign: "center" }}>
                {"\uD83C\uDFC6"} Tournament Complete!
              </h3>
              {winner && (
                <p className="tourney-winner-name">{winner.name} wins!</p>
              )}
              <p className="player-modal-buyin" style={{ textAlign: "center" }}>
                Pot: <strong>${finished.totalPot.toLocaleString("en-US")}</strong>
              </p>
              <div className="tourney-standings">
                {finished.players.map((p, i) => (
                  <div key={i} className="tourney-standing-row">
                    <span className="tourney-standing-place">
                      {p.placement === 1 ? "\uD83C\uDFC6" : `${p.placement}${ordSuffix(p.placement)}`}
                    </span>
                    <span className="tourney-standing-name">{p.name}</span>
                  </div>
                ))}
              </div>
              <button className="modal-btn modal-btn-submit" onClick={() => setFinished(null)}>
                Close
              </button>
            </div>
          </div>
        );
      })()}

      {/* ───── BLIND SCHEDULE ───── */}
      {blindsOpen && (
        <div className="modal-backdrop" onClick={() => setBlindsOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Blind Schedule</h3>
            <p className="player-modal-buyin" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
              15 minutes per level
            </p>
            <div className="tourney-blind-schedule">
              {BLIND_LEVELS.map(([sm, big], i) => (
                <div
                  key={i}
                  className={`tourney-blind-row ${state?.started && state.blindLevel === i ? "tourney-blind-active" : ""}`}
                >
                  <span className="tourney-blind-level">Level {i + 1}</span>
                  <span className="tourney-blind-amount">{sm} / {big}</span>
                </div>
              ))}
            </div>
            <button className="modal-btn modal-btn-cancel" style={{ marginTop: "0.5rem" }} onClick={() => setBlindsOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ───── TOURNAMENT HISTORY ───── */}
      {historyOpen && (
        <div className="modal-backdrop" onClick={() => setHistoryOpen(false)}>
          <div className="modal-card history-card" onClick={(e) => e.stopPropagation()}>
            <div className="history-header">
              <h3 className="modal-title">Tournament History</h3>
              <button className="history-close" onClick={() => setHistoryOpen(false)}>&times;</button>
            </div>

            {selectedIdx === null ? (
              <div className="history-dates">
                {history.length === 0 ? (
                  <p className="history-empty">No tournaments recorded yet.</p>
                ) : (
                  history.map((t, i) => {
                    const winner = t.players.find((p) => p.placement === 1);
                    return (
                      <button key={i} className="history-date-btn tourney-history-btn" onClick={() => setSelectedIdx(i)}>
                        <span className="tourney-hist-date">{fmtDate(t.date)}</span>
                        <span className="tourney-hist-info">{t.players.length} players &middot; ${t.totalPot}</span>
                        <span className="tourney-hist-winner">{"\uD83C\uDFC6"} {winner?.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="history-sessions">
                <button className="history-back" onClick={() => setSelectedIdx(null)}>
                  &larr; All Tournaments
                </button>
                <p className="history-date-label">{fmtDate(history[selectedIdx].date)}</p>
                <p className="player-modal-buyin" style={{ marginBottom: "0.75rem" }}>
                  Buy-in: ${history[selectedIdx].buyin} &middot; Pot: ${history[selectedIdx].totalPot.toLocaleString("en-US")}
                </p>
                <div className="session-list">
                  <div className="session-row session-row-header">
                    <span className="session-col-paid"></span>
                    <span className="session-col-name">Player</span>
                    <span className="session-col">Place</span>
                  </div>
                  {history[selectedIdx].players.map((p, i) => (
                    <div key={i} className="session-row">
                      <span className="session-col-paid">{p.placement === 1 ? "\uD83C\uDFC6" : ""}</span>
                      <span className="session-col-name">{p.name}</span>
                      <span className="session-col">{p.placement}{ordSuffix(p.placement)}</span>
                    </div>
                  ))}
                </div>
                <button
                  className="modal-btn modal-btn-delete"
                  style={{ marginTop: "0.75rem" }}
                  onClick={() => deleteHistory(selectedIdx)}
                >
                  Delete Tournament
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
