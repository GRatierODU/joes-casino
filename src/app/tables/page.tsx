"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Seat = { name: string; buyin: number } | null;
type TablesState = { tables: [Seat[], Seat[]] };

const EMPTY: TablesState = {
  tables: [Array(8).fill(null), Array(8).fill(null)],
};

type ModalState =
  | { kind: "sit"; table: number; seat: number }
  | { kind: "player"; table: number; seat: number; name: string; buyin: number }
  | { kind: "rebuy"; table: number; seat: number; name: string }
  | { kind: "leave"; table: number; seat: number; name: string }
  | null;

export default function TablesPage() {
  const [state, setState] = useState<TablesState>(EMPTY);
  const [modal, setModal] = useState<ModalState>(null);
  const [formName, setFormName] = useState("");
  const [formBuyin, setFormBuyin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchState = useCallback(() => {
    fetch("/api/tables")
      .then((r) => r.json())
      .then((d: TablesState) => setState(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, 5000);
    return () => clearInterval(id);
  }, [fetchState]);

  const isOpen = state.tables.some((t) => t.some((s) => s !== null));
  const totalPlayers = state.tables.flat().filter((s) => s !== null).length;

  const handleSit = useCallback(async () => {
    if (!modal || modal.kind !== "sit") return;
    setError("");
    const buyin = parseFloat(formBuyin);
    if (!formName.trim()) {
      setError("Enter your name.");
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
          name: formName.trim(),
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
  }, [modal, formName, formBuyin]);

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
    setSubmitting(true);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "leave",
          table: modal.table,
          seat: modal.seat,
        }),
      });
      if (res.ok) {
        setState(await res.json());
        setModal(null);
      }
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false);
    }
  }, [modal]);

  const openSit = (table: number, seat: number) => {
    setFormName("");
    setFormBuyin("");
    setError("");
    setModal({ kind: "sit", table, seat });
  };

  const openPlayer = (table: number, seat: number, name: string, buyin: number) => {
    setError("");
    setModal({ kind: "player", table, seat, name, buyin });
  };

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
        <Link href="/" className="tables-nav-link">
          &larr; Leaderboard
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
                      ? openPlayer(ti, si, s.name, s.buyin)
                      : openSit(ti, si)
                  }
                >
                  {s ? (
                    <div className="seat-info">
                      <span className="seat-name">{s.name}</span>
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
              Name
              <input
                className="modal-input"
                type="text"
                placeholder="Your name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
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
                  setError("");
                  setModal({ kind: "leave", table: modal.table, seat: modal.seat, name: modal.name });
                }}
              >
                Cash Out
              </button>
            </div>
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

      {/* ───── CASHOUT CONFIRMATION ───── */}
      {modal?.kind === "leave" && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div
            className="modal-card confirm-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">Cash Out?</h3>
            <p className="confirm-detail">
              <span className="confirm-name">{modal.name}</span>
            </p>
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
    </div>
  );
}
