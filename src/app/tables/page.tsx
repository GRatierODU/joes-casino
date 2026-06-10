"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import Link from "next/link";
import type { PublicPlayer, TableSeat } from "@/lib/players";
import { seatDisplayLabel, seatPicture } from "@/lib/players";

type Seat = TableSeat;
type TablesState = { tables: [Seat[], Seat[]] };

const EMPTY: TablesState = {
  tables: [Array(10).fill(null), Array(10).fill(null)],
};

type SessionRecord = {
  name: string;
  buyin: number;
  cashout: number;
  table: number;
  paid?: boolean;
  playerId?: string;
};

type ModalState =
  | { kind: "sit"; table: number; seat: number }
  | { kind: "player"; table: number; seat: number; name: string; buyin: number }
  | { kind: "rebuy"; table: number; seat: number; name: string }
  | { kind: "leave"; table: number; seat: number; name: string; buyin: number }
  | { kind: "move"; table: number; seat: number; name: string }
  | null;

const TABLES_GATE_STORAGE = "joes-tables-gate";
/** Temporary gate password (client-side only). */
const TABLES_GATE_PASSWORD = "joescasino";

export default function TablesPage() {
  const [gateReady, setGateReady] = useState(false);
  const [tablesUnlocked, setTablesUnlocked] = useState(false);
  const [gatePw, setGatePw] = useState("");
  const [gateError, setGateError] = useState("");

  const [state, setState] = useState<TablesState>(EMPTY);
  const [modal, setModal] = useState<ModalState>(null);
  const [formPlayerId, setFormPlayerId] = useState("");
  const [formBuyin, setFormBuyin] = useState("");
  const [formCashout, setFormCashout] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [addToBoard, setAddToBoard] = useState<{ session: SessionRecord; date: string; index: number } | null>(null);
  const [addingToBoard, setAddingToBoard] = useState(false);

  const CREATE_PLAYER = "__create_player__";

  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [managePlayers, setManagePlayers] = useState(false);
  const [manageForm, setManageForm] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    picture: "",
  });
  const [editingPlayer, setEditingPlayer] = useState<PublicPlayer | null>(null);
  const [quickAddPlayer, setQuickAddPlayer] = useState(false);
  const [quickAdd, setQuickAdd] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    picture: "",
  });
  const [quickAddError, setQuickAddError] = useState("");
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);

  useEffect(() => {
    try {
      setTablesUnlocked(sessionStorage.getItem(TABLES_GATE_STORAGE) === "1");
    } catch {
      setTablesUnlocked(false);
    }
    setGateReady(true);
  }, []);

  useEffect(() => {
    if (!tablesUnlocked) return;
    fetch("/api/players")
      .then((r) => r.json())
      .then((d) => setPlayers(d.players ?? []))
      .catch(() => {});
  }, [tablesUnlocked]);

  const fetchState = useCallback(() => {
    fetch("/api/tables")
      .then((r) => r.json())
      .then((d: TablesState) => setState(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!tablesUnlocked) return;
    fetchState();
    const id = setInterval(fetchState, 5000);
    return () => clearInterval(id);
  }, [fetchState, tablesUnlocked]);

  const isOpen = state.tables.some((t) => t.some((s) => s !== null));
  const occupiedSeats = state.tables.flat().filter((s): s is Exclude<Seat, null> => s !== null);
  const totalPlayers = occupiedSeats.length;
  const totalInPlay = occupiedSeats.reduce((sum, s) => sum + s.buyin, 0);

  const handleSit = useCallback(async () => {
    if (!modal || modal.kind !== "sit") return;
    setError("");
    const buyin = parseFloat(formBuyin);
    if (!formPlayerId.trim()) {
      setError("Select a player.");
      return;
    }
    if (isNaN(buyin) || buyin <= 0) {
      setError("Enter a valid buy-in amount.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sit",
          table: modal.table,
          seat: modal.seat,
          playerId: formPlayerId.trim(),
          buyin,
        }),
      });
      if (res.ok) {
        setState(await res.json());
        setModal(null);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to sit down.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }, [modal, formPlayerId, formBuyin]);

  const handleRebuy = useCallback(async () => {
    if (!modal || modal.kind !== "rebuy") return;
    setError("");
    const buyin = parseFloat(formBuyin);
    if (isNaN(buyin) || buyin <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          table: modal.table,
          seat: modal.seat,
          buyin,
        }),
      });
      if (res.ok) {
        setState(await res.json());
        setModal(null);
      } else {
        setError("Failed to add re-buy.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }, [modal, formBuyin]);

  const handleLeave = useCallback(async () => {
    if (!modal || modal.kind !== "leave") return;
    setError("");
    const co = parseFloat(formCashout);
    if (isNaN(co) || co < 0) {
      setError("Enter a valid cashout amount.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "leave",
          table: modal.table,
          seat: modal.seat,
          cashout: co,
        }),
      });
      if (res.ok) {
        setState(await res.json());
        setModal(null);
      } else {
        setError("Failed to cash out.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }, [modal, formCashout]);

  const openSit = (table: number, seat: number) => {
    setFormPlayerId("");
    setFormBuyin("");
    setError("");
    setModal({ kind: "sit", table, seat });
  };

  const openPlayer = (table: number, seat: number, name: string, buyin: number) => {
    setError("");
    setModal({ kind: "player", table, seat, name, buyin });
  };

  const handleQuickAddPlayer = useCallback(async () => {
    if (!quickAdd.firstName.trim() || !quickAdd.lastName.trim()) {
      setQuickAddError("First and last name are required.");
      return;
    }
    setQuickAddSubmitting(true);
    setQuickAddError("");
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: quickAdd.firstName.trim(),
          lastName: quickAdd.lastName.trim(),
          nickname: quickAdd.nickname.trim() || undefined,
          picture: quickAdd.picture.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.players) {
        setPlayers(data.players);
        if (typeof data.createdId === "string") setFormPlayerId(data.createdId);
        setQuickAddPlayer(false);
        setQuickAdd({ firstName: "", lastName: "", nickname: "", picture: "" });
      } else {
        setQuickAddError(data.error || "Could not add player.");
      }
    } catch {
      setQuickAddError("Network error.");
    }
    setQuickAddSubmitting(false);
  }, [quickAdd]);

  const handleGateSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = gatePw.trim();
    if (v === TABLES_GATE_PASSWORD) {
      try {
        sessionStorage.setItem(TABLES_GATE_STORAGE, "1");
      } catch {
        /* ignore private mode / quota */
      }
      setTablesUnlocked(true);
      setGateError("");
      setGatePw("");
    } else {
      setGateError("Wrong password.");
    }
  };

  const showGateOverlay = !gateReady || !tablesUnlocked;
  const pageInteractive = gateReady && tablesUnlocked;

  return (
    <>
    <div
      className={`tables-page${!pageInteractive ? " tables-page--behind-gate" : ""}`}
      aria-hidden={!pageInteractive}
    >
      <div className="tables-suits" aria-hidden="true">
        <span className="suit suit-1">&spades;</span>
        <span className="suit suit-2">&hearts;</span>
        <span className="suit suit-3">&diams;</span>
        <span className="suit suit-4">&clubs;</span>
        <span className="suit suit-5">&hearts;</span>
        <span className="suit suit-6">&spades;</span>
      </div>
      <nav className="tables-nav">
        <Link href="/" className="tables-nav-link">
          &larr; Leaderboard
        </Link>
        <Link href="/tournaments" className="tables-nav-link">
          Tournaments
        </Link>
        <Link href="/stats" className="tables-nav-link">
          Stats
        </Link>
        <Link href="/bad-beats" className="tables-nav-link">
          Bad Beats
        </Link>
        <Link href="/chat" className="tables-nav-link">
          VIP Lounge
        </Link>
      </nav>

      <header className="tables-header">
        <div className={`status-badge ${isOpen ? "status-open" : "status-closed"}`}>
          <span className="status-dot" />
          {isOpen ? "OPEN" : "CLOSED"}
        </div>
        <h1 className="tables-title">Joe&apos;s Casino</h1>
        <p className="tables-sub">
          {isOpen
            ? `${totalPlayers} player${totalPlayers !== 1 ? "s" : ""} at the table${totalPlayers > 1 ? "s" : ""}`
            : "No active games right now"}
        </p>
        {isOpen && (
          <p className="tables-in-play">${totalInPlay.toLocaleString("en-US")} in play</p>
        )}
        <button
          className="history-btn"
          onClick={async () => {
            setHistoryOpen(true);
            setSelectedDate(null);
            setSessions([]);
            try {
              const res = await fetch("/api/sessions");
              const data = await res.json();
              setHistoryDates(data.dates ?? []);
            } catch { /* ignore */ }
          }}
        >
          Session History
        </button>
        <button
          className="history-btn"
          onClick={() => {
            setManagePlayers(true);
            setManageForm({ firstName: "", lastName: "", nickname: "", picture: "" });
            setEditingPlayer(null);
            setError("");
          }}
        >
          Manage Players
        </button>
      </header>

      <div className="tables-grid">
        {state.tables.map((seats, ti) => (
          <div key={ti} className="poker-table-wrap">
            <h2 className="table-label">Table {ti + 1}</h2>
            <div className="poker-table">
              <div className="felt">
                <span className="felt-text">Joe&apos;s Casino</span>
              </div>
              {seats.map((s, si) => (
                <button
                  key={si}
                  className={`seat seat-${si} ${s ? "seat-occupied" : "seat-empty"}`}
                  onClick={() =>
                    s
                      ? openPlayer(ti, si, seatDisplayLabel(s, players), s.buyin)
                      : openSit(ti, si)
                  }
                >
                  <span className="seat-number">{si + 1}</span>
                  {s ? (
                    <div className="seat-info">
                      {seatPicture(s, players) ? (
                        <img
                          className="seat-avatar"
                          src={seatPicture(s, players)}
                          alt=""
                        />
                      ) : null}
                      <span className="seat-name">{seatDisplayLabel(s, players)}</span>
                      <span className="seat-buyin">
                        ${s.buyin.toLocaleString("en-US")}
                      </span>
                    </div>
                  ) : (
                    <span className="seat-open-label">Open</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ───── SIT DOWN MODAL ───── */}
      {modal?.kind === "sit" && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              Sit Down &mdash; Table {modal.table + 1}, Seat {modal.seat + 1}
            </h3>
            <label className="modal-label">
              Player
              <select
                className="modal-input modal-select"
                value={formPlayerId}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === CREATE_PLAYER) {
                    setQuickAddPlayer(true);
                    setQuickAdd({ firstName: "", lastName: "", nickname: "", picture: "" });
                    setQuickAddError("");
                  } else {
                    setFormPlayerId(v);
                  }
                }}
              >
                <option value="">Select a player</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
                <option value={CREATE_PLAYER}>+ Create new player</option>
              </select>
            </label>
            <label className="modal-label">
              Buy-in ($)
              <input
                className="modal-input"
                type="number"
                placeholder="e.g. 50"
                min="1"
                value={formBuyin}
                onChange={(e) => setFormBuyin(e.target.value)}
              />
            </label>
            {error && (
              <p style={{ color: "#ef4444", fontSize: "0.85rem", margin: 0 }}>
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                className="modal-btn modal-btn-cancel"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button
                className="modal-btn modal-btn-submit"
                onClick={handleSit}
                disabled={submitting}
              >
                {submitting ? "Sitting..." : "Sit Down"}
              </button>
            </div>
          </div>
        </div>
      )}

      {quickAddPlayer && (
        <div className="modal-backdrop modal-backdrop-top" onClick={() => setQuickAddPlayer(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Create new player</h3>
            <label className="modal-label">
              First name
              <input
                className="modal-input"
                type="text"
                autoComplete="given-name"
                value={quickAdd.firstName}
                onChange={(e) => setQuickAdd((q) => ({ ...q, firstName: e.target.value }))}
              />
            </label>
            <label className="modal-label">
              Last name
              <input
                className="modal-input"
                type="text"
                autoComplete="family-name"
                value={quickAdd.lastName}
                onChange={(e) => setQuickAdd((q) => ({ ...q, lastName: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleQuickAddPlayer();
                  }
                }}
              />
            </label>
            <label className="modal-label">
              Nickname <span style={{ textTransform: "none", letterSpacing: "0" }}>(optional)</span>
              <input
                className="modal-input"
                type="text"
                placeholder="Shown instead of First L."
                value={quickAdd.nickname}
                onChange={(e) => setQuickAdd((q) => ({ ...q, nickname: e.target.value }))}
              />
            </label>
            <label className="modal-label">
              Picture URL <span style={{ textTransform: "none", letterSpacing: "0" }}>(optional)</span>
              <input
                className="modal-input"
                type="url"
                placeholder="https://..."
                value={quickAdd.picture}
                onChange={(e) => setQuickAdd((q) => ({ ...q, picture: e.target.value }))}
              />
            </label>
            {quickAddError && (
              <p style={{ color: "#ef4444", fontSize: "0.85rem", margin: 0 }}>{quickAddError}</p>
            )}
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setQuickAddPlayer(false)}>
                Cancel
              </button>
              <button
                className="modal-btn modal-btn-submit"
                disabled={quickAddSubmitting}
                onClick={() => void handleQuickAddPlayer()}
              >
                {quickAddSubmitting ? "Adding..." : "Add player"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── PLAYER OPTIONS MODAL ───── */}
      {modal?.kind === "player" && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{modal.name}</h3>
            <p className="player-modal-buyin">
              Total buy-in: <strong>${modal.buyin.toLocaleString("en-US")}</strong>
            </p>
            <div className="player-modal-options">
              <button
                className="player-option-btn player-option-rebuy"
                onClick={() => {
                  setFormBuyin("");
                  setError("");
                  setModal({ kind: "rebuy", table: modal.table, seat: modal.seat, name: modal.name });
                }}
              >
                Re-buy
              </button>
              <button
                className="player-option-btn player-option-cashout"
                onClick={() => {
                  setFormCashout("");
                  setError("");
                  setModal({ kind: "leave", table: modal.table, seat: modal.seat, name: modal.name, buyin: modal.buyin });
                }}
              >
                Cash Out
              </button>
            </div>
            <button
              className="player-option-btn player-option-move"
              onClick={() => {
                setError("");
                setModal({ kind: "move", table: modal.table, seat: modal.seat, name: modal.name });
              }}
            >
              Move Seat
            </button>
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
            {state.tables.map((seats, ti) => {
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
                        key={si}
                        className="move-seat-btn"
                        disabled={submitting}
                        onClick={async () => {
                          setSubmitting(true);
                          try {
                            const res = await fetch("/api/tables", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "move",
                                table: modal.table,
                                seat: modal.seat,
                                toTable: ti,
                                toSeat: si,
                              }),
                            });
                            if (res.ok) {
                              setState(await res.json());
                              setModal(null);
                            }
                          } catch { /* ignore */ }
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
            <button
              className="modal-btn modal-btn-cancel"
              style={{ marginTop: "0.5rem" }}
              onClick={() => setModal(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ───── REBUY MODAL ───── */}
      {modal?.kind === "rebuy" && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              Re-buy &mdash; {modal.name}
            </h3>
            <label className="modal-label">
              Amount ($)
              <input
                className="modal-input"
                type="number"
                placeholder="e.g. 25"
                min="1"
                value={formBuyin}
                onChange={(e) => setFormBuyin(e.target.value)}
              />
            </label>
            {error && (
              <p style={{ color: "#ef4444", fontSize: "0.85rem", margin: 0 }}>
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                className="modal-btn modal-btn-cancel"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button
                className="modal-btn modal-btn-submit"
                onClick={handleRebuy}
                disabled={submitting}
              >
                {submitting ? "Adding..." : "Add Re-buy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── HISTORY MODAL ───── */}
      {historyOpen && (
        <div className="modal-backdrop" onClick={() => setHistoryOpen(false)}>
          <div
            className="modal-card history-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="history-header">
              <h3 className="modal-title">Session History</h3>
              <button
                className="history-close"
                onClick={() => setHistoryOpen(false)}
              >
                &times;
              </button>
            </div>

            {!selectedDate ? (
              <div className="history-dates">
                {historyDates.length === 0 ? (
                  <p className="history-empty">No sessions recorded yet.</p>
                ) : (
                  historyDates.map((d) => (
                    <button
                      key={d}
                      className="history-date-btn"
                      onClick={async () => {
                        setSelectedDate(d);
                        try {
                          const res = await fetch(`/api/sessions?date=${d}`);
                          const data = await res.json();
                          setSessions(data.sessions ?? []);
                        } catch { /* ignore */ }
                      }}
                    >
                      {new Date(d + "T12:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="history-sessions">
                <button
                  className="history-back"
                  onClick={() => {
                    setSelectedDate(null);
                    setSessions([]);
                  }}
                >
                  &larr; All Dates
                </button>
                <p className="history-date-label">
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                {sessions.length === 0 ? (
                  <p className="history-empty">No sessions for this date.</p>
                ) : (
                  <div className="session-list">
                    <div className="session-row session-row-header">
                      <span className="session-col-paid"></span>
                      <span className="session-col-name">Name</span>
                      <span className="session-col">Buy-in</span>
                      <span className="session-col">Cashout</span>
                      <span className="session-col">P/L</span>
                    </div>
                    {sessions
                      .map((s, origIdx) => ({ s, origIdx }))
                      .sort((a, b) => (b.s.cashout - b.s.buyin) - (a.s.cashout - a.s.buyin))
                      .map(({ s, origIdx }) => {
                      const pl = s.cashout - s.buyin;
                      return (
                        <button
                          key={origIdx}
                          className="session-row session-row-clickable"
                          onClick={() => setAddToBoard({ session: s, date: selectedDate!, index: origIdx })}
                        >
                          <span className={`session-col-paid ${(s.paid || s.cashout === 0) ? "session-paid" : ""}`}>
                            {(s.paid || s.cashout === 0) ? "\uD83D\uDCB0" : ""}
                          </span>
                          <span className="session-col-name">{s.name}</span>
                          <span className="session-col">${s.buyin.toLocaleString("en-US")}</span>
                          <span className="session-col">${s.cashout.toLocaleString("en-US")}</span>
                          <span className={`session-col ${pl >= 0 ? "session-profit" : "session-loss"}`}>
                            {pl >= 0 ? "+" : "-"}${Math.abs(pl).toLocaleString("en-US")}
                          </span>
                        </button>
                      );
                    })}
                    <div className="session-row session-totals">
                      <span className="session-col-paid"></span>
                      <span className="session-col-name">Totals</span>
                      <span className="session-col">
                        ${sessions.reduce((sum, s) => sum + s.buyin, 0).toLocaleString("en-US")}
                      </span>
                      <span className="session-col">
                        ${sessions.reduce((sum, s) => sum + s.cashout, 0).toLocaleString("en-US")}
                      </span>
                      <span className="session-col"></span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───── ADD TO LEADERBOARD MODAL ───── */}
      {addToBoard && (() => {
        const pl = addToBoard.session.cashout - addToBoard.session.buyin;
        const dateParts = addToBoard.date.split("-");
        const dateStr = `${parseInt(dateParts[1])}/${parseInt(dateParts[2])}/${dateParts[0].slice(2)}`;
        return (
          <div className="modal-backdrop" onClick={() => setAddToBoard(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-title">Add to Leaderboard?</h3>
              <p className="player-modal-buyin" style={{ marginBottom: "0.25rem" }}>
                <strong>{addToBoard.session.name}</strong>
              </p>
              <p className="player-modal-buyin">
                P/L: <strong className={pl >= 0 ? "session-profit" : "session-loss"}>
                  {pl >= 0 ? "+" : "-"}${Math.abs(pl).toLocaleString("en-US")}
                </strong>
              </p>
              <div className="player-modal-options">
                <button
                  className="player-option-btn player-option-rebuy"
                  disabled={addingToBoard}
                  onClick={async () => {
                    setAddingToBoard(true);
                    try {
                      await fetch("/api/leaderboard", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          board: "winner",
                          date: dateStr,
                          name: addToBoard.session.name,
                          amount: Math.abs(pl),
                        }),
                      });
                      setAddToBoard(null);
                    } catch { /* ignore */ }
                    setAddingToBoard(false);
                  }}
                >
                  {addingToBoard ? "Adding..." : "Top Winners"}
                </button>
                <button
                  className="player-option-btn player-option-cashout"
                  disabled={addingToBoard}
                  onClick={async () => {
                    setAddingToBoard(true);
                    try {
                      await fetch("/api/leaderboard", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          board: "loser",
                          date: dateStr,
                          name: addToBoard.session.name,
                          amount: Math.abs(pl),
                        }),
                      });
                      setAddToBoard(null);
                    } catch { /* ignore */ }
                    setAddingToBoard(false);
                  }}
                >
                  {addingToBoard ? "Adding..." : "Top Losers"}
                </button>
              </div>
              {pl >= 0 && (
                <button
                  className="modal-btn modal-btn-submit"
                  style={{ marginTop: "0.75rem" }}
                  disabled={addingToBoard}
                  onClick={async () => {
                    setAddingToBoard(true);
                    try {
                      const res = await fetch("/api/sessions", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          date: addToBoard.date,
                          index: addToBoard.index,
                        }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setSessions(data.sessions ?? []);
                        setAddToBoard(null);
                      }
                    } catch { /* ignore */ }
                    setAddingToBoard(false);
                  }}
                >
                  {addToBoard.session.paid ? "Mark Unpaid" : "Mark Paid"}
                </button>
              )}
              <button
                className="modal-btn modal-btn-delete"
                style={{ marginTop: "0.25rem" }}
                disabled={addingToBoard}
                onClick={async () => {
                  setAddingToBoard(true);
                  try {
                    const res = await fetch("/api/sessions", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        date: addToBoard.date,
                        index: addToBoard.index,
                      }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setSessions(data.sessions ?? []);
                      if (data.dates) setHistoryDates(data.dates);
                      setAddToBoard(null);
                    }
                  } catch { /* ignore */ }
                  setAddingToBoard(false);
                }}
              >
                {addingToBoard ? "Deleting..." : "Delete Session"}
              </button>
              <button
                className="modal-btn modal-btn-cancel"
                style={{ marginTop: "0.25rem" }}
                onClick={() => setAddToBoard(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })()}

      {/* ───── CASHOUT MODAL ───── */}
      {modal?.kind === "leave" && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Cash Out &mdash; {modal.name}</h3>
            <p className="player-modal-buyin">
              Total buy-in: <strong>${modal.buyin.toLocaleString("en-US")}</strong>
            </p>
            <label className="modal-label">
              Cashout Amount ($)
              <input
                className="modal-input"
                type="number"
                placeholder="e.g. 75"
                min="0"
                value={formCashout}
                onChange={(e) => setFormCashout(e.target.value)}
              />
            </label>
            {error && (
              <p style={{ color: "#ef4444", fontSize: "0.85rem", margin: 0 }}>
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                className="modal-btn modal-btn-cancel"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button
                className="modal-btn modal-btn-delete"
                onClick={handleLeave}
                disabled={submitting}
              >
                {submitting ? "Cashing out..." : "Cash Out"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── MANAGE PLAYERS MODAL ───── */}
      {managePlayers && (
        <div className="modal-backdrop" onClick={() => setManagePlayers(false)}>
          <div className="modal-card manage-players-card" onClick={(e) => e.stopPropagation()}>
            <div className="history-header">
              <h3 className="modal-title">{editingPlayer ? "Edit player" : "Manage Players"}</h3>
              <button className="history-close" onClick={() => setManagePlayers(false)}>&times;</button>
            </div>
            {editingPlayer ? (
              <>
                <label className="modal-label">
                  First name
                  <input
                    className="modal-input"
                    value={manageForm.firstName}
                    onChange={(e) => setManageForm((f) => ({ ...f, firstName: e.target.value }))}
                  />
                </label>
                <label className="modal-label">
                  Last name
                  <input
                    className="modal-input"
                    value={manageForm.lastName}
                    onChange={(e) => setManageForm((f) => ({ ...f, lastName: e.target.value }))}
                  />
                </label>
                <label className="modal-label">
                  Nickname <span style={{ textTransform: "none", letterSpacing: "0" }}>(optional)</span>
                  <input
                    className="modal-input"
                    value={manageForm.nickname}
                    onChange={(e) => setManageForm((f) => ({ ...f, nickname: e.target.value }))}
                  />
                </label>
                <label className="modal-label">
                  Picture URL <span style={{ textTransform: "none", letterSpacing: "0" }}>(optional)</span>
                  <input
                    className="modal-input"
                    type="url"
                    value={manageForm.picture}
                    onChange={(e) => setManageForm((f) => ({ ...f, picture: e.target.value }))}
                  />
                </label>
                {error && <p style={{ color: "#ef4444", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
                <div className="modal-actions">
                  <button
                    className="modal-btn modal-btn-cancel"
                    onClick={() => {
                      setEditingPlayer(null);
                      setManageForm({ firstName: "", lastName: "", nickname: "", picture: "" });
                      setError("");
                    }}
                  >
                    Back
                  </button>
                  <button
                    className="modal-btn modal-btn-submit"
                    onClick={async () => {
                      if (!editingPlayer || !manageForm.firstName.trim() || !manageForm.lastName.trim()) {
                        setError("First and last name are required.");
                        return;
                      }
                      try {
                        const res = await fetch("/api/players", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            id: editingPlayer.id,
                            firstName: manageForm.firstName.trim(),
                            lastName: manageForm.lastName.trim(),
                            nickname: manageForm.nickname.trim() || null,
                            picture: manageForm.picture.trim() || null,
                          }),
                        });
                        const d = await res.json();
                        if (res.ok && d.players) {
                          setPlayers(d.players);
                          setEditingPlayer(null);
                          setManageForm({ firstName: "", lastName: "", nickname: "", picture: "" });
                          setError("");
                        } else setError(d.error || "Failed");
                      } catch {
                        setError("Network error");
                      }
                    }}
                  >
                    Save
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="player-modal-buyin" style={{ marginBottom: "0.75rem" }}>
                  Add a player (shown at tables as nickname, or First L.)
                </p>
                <label className="modal-label">
                  First name
                  <input
                    className="modal-input"
                    value={manageForm.firstName}
                    onChange={(e) => setManageForm((f) => ({ ...f, firstName: e.target.value }))}
                  />
                </label>
                <label className="modal-label">
                  Last name
                  <input
                    className="modal-input"
                    value={manageForm.lastName}
                    onChange={(e) => setManageForm((f) => ({ ...f, lastName: e.target.value }))}
                  />
                </label>
                <label className="modal-label">
                  Nickname <span style={{ textTransform: "none", letterSpacing: "0" }}>(optional)</span>
                  <input
                    className="modal-input"
                    value={manageForm.nickname}
                    onChange={(e) => setManageForm((f) => ({ ...f, nickname: e.target.value }))}
                  />
                </label>
                <label className="modal-label">
                  Picture URL <span style={{ textTransform: "none", letterSpacing: "0" }}>(optional)</span>
                  <input
                    className="modal-input"
                    type="url"
                    value={manageForm.picture}
                    onChange={(e) => setManageForm((f) => ({ ...f, picture: e.target.value }))}
                  />
                </label>
                <button
                  className="modal-btn modal-btn-submit"
                  style={{ width: "100%" }}
                  onClick={async () => {
                    if (!manageForm.firstName.trim() || !manageForm.lastName.trim()) {
                      setError("First and last name are required.");
                      return;
                    }
                    setError("");
                    try {
                      const res = await fetch("/api/players", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          firstName: manageForm.firstName.trim(),
                          lastName: manageForm.lastName.trim(),
                          nickname: manageForm.nickname.trim() || undefined,
                          picture: manageForm.picture.trim() || undefined,
                        }),
                      });
                      const d = await res.json();
                      if (res.ok && d.players) {
                        setPlayers(d.players);
                        setManageForm({ firstName: "", lastName: "", nickname: "", picture: "" });
                      } else setError(d.error || "Failed");
                    } catch {
                      setError("Network error");
                    }
                  }}
                >
                  Add player
                </button>
                {error && <p style={{ color: "#ef4444", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
                <div className="manage-player-list">
                  {players.length === 0 ? (
                    <p className="history-empty">No players yet.</p>
                  ) : (
                    players.map((p) => (
                      <div key={p.id} className="manage-player-row">
                        {p.picture ? (
                          <img className="manage-player-avatar" src={p.picture} alt="" />
                        ) : (
                          <span className="manage-player-avatar-placeholder" aria-hidden />
                        )}
                        <span className="manage-player-name">{p.displayName}</span>
                        <button
                          type="button"
                          className="modal-btn modal-btn-cancel"
                          style={{ flex: "0 0 auto", padding: "0.35rem 0.6rem", fontSize: "0.7rem" }}
                          onClick={() => {
                            setEditingPlayer(p);
                            setManageForm({
                              firstName: p.firstName,
                              lastName: p.lastName,
                              nickname: p.nickname ?? "",
                              picture: p.picture ?? "",
                            });
                            setError("");
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="board-delete"
                          style={{ opacity: 1 }}
                          onClick={async () => {
                            try {
                              const res = await fetch("/api/players", {
                                method: "DELETE",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: p.id }),
                              });
                              if (res.ok) {
                                const d = await res.json();
                                setPlayers(d.players);
                              }
                            } catch {}
                          }}
                        >
                          &times;
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>

    {showGateOverlay && (
      <div className="tables-gate-overlay" role="presentation">
        {!gateReady ? (
          <p className="tables-gate-loading">Loading…</p>
        ) : (
          <form
            className="modal-card tables-gate-card"
            onSubmit={handleGateSubmit}
            autoComplete="off"
          >
            <h2 className="modal-title">Live tables</h2>
            <p className="tables-gate-hint">Enter the password to view and manage tables.</p>
            <label className="modal-label">
              Password
              <input
                className="modal-input"
                type="password"
                name="tables-gate-password"
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
    )}
    </>
  );
}
