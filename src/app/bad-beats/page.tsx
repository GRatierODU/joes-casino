"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  formatBadBeatEntryWhen,
  isBadBeatLegacy,
  parseBadBeatCard,
  parseBeatDateInput,
  seatsArrayFromRows,
  type BadBeatEntry,
} from "@/lib/badBeatCards";
import { sessionCalendarDateISO } from "@/lib/sessionDate";
import {
  BadBeatPokerTable,
  CardFace,
  CardPickerOverlay,
  emptySeats,
  usedForPicker,
  type PickerTarget,
  type SeatCell,
} from "./BadBeatTableVisual";

const EMPTY_BOARD: [string, string, string, string, string] = ["", "", "", "", ""];

type SeatFormState = { seat: number; name: string; hole: [string, string] };

export default function BadBeatsPage() {
  const [entries, setEntries] = useState<BadBeatEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [seats, setSeats] = useState<SeatCell[]>(emptySeats);
  const [board, setBoard] =
    useState<[string, string, string, string, string]>(EMPTY_BOARD);
  const [seatForm, setSeatForm] = useState<SeatFormState | null>(null);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [beatDate, setBeatDate] = useState(() => sessionCalendarDateISO());

  const load = useCallback(() => {
    fetch("/api/bad-beats")
      .then((r) => r.json())
      .then((d: { entries?: BadBeatEntry[] }) => setEntries(d.entries ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetEditor = () => {
    setSeats(emptySeats());
    setBoard([...EMPTY_BOARD]);
    setSeatForm(null);
    setPicker(null);
    setError("");
    setBeatDate(sessionCalendarDateISO());
  };

  const openModal = () => {
    resetEditor();
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    resetEditor();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const rows = seats
      .map((cell, seat) => (cell ? { seat, name: cell.name, hole: cell.hole } : null))
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (rows.length === 0) {
      setError("Add at least one player at a seat (name + two cards).");
      return;
    }
    if (board.some((c) => !parseBadBeatCard(c))) {
      setError("Fill all five board cards.");
      return;
    }
    const beatDateNorm = parseBeatDateInput(beatDate);
    if (!beatDateNorm) {
      setError("Pick a valid bad beat night (calendar date).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bad-beats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seats: rows, board, beatDate: beatDateNorm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save.");
        return;
      }
      setEntries(data.entries ?? []);
      closeModal();
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch("/api/bad-beats", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
      }
    } catch {
      /* ignore */
    }
  };

  const handlePick = (code: string) => {
    if (!picker) return;
    if (picker.kind === "board") {
      setBoard((b) => {
        const n = [...b] as [string, string, string, string, string];
        n[picker.index] = code;
        return n;
      });
    } else if (seatForm && seatForm.seat === picker.seat) {
      setSeatForm((f) => {
        if (!f) return f;
        const hole = [...f.hole] as [string, string];
        hole[picker.which] = code;
        return { ...f, hole };
      });
    }
    setPicker(null);
  };

  const pendingForPicker = seatForm ? { seat: seatForm.seat, hole: seatForm.hole } : null;

  return (
    <div className="bad-beats-page">
      <div className="tables-suits bad-beats-suits" aria-hidden="true">
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
        <Link href="/tables" className="tables-nav-link">
          Live Tables
        </Link>
        <Link href="/tournaments" className="tables-nav-link">
          Tournaments
        </Link>
        <Link href="/stats" className="tables-nav-link">
          Stats
        </Link>
      </nav>

      <header className="bad-beats-header">
        <p className="bad-beats-eyebrow">Joe&apos;s Casino</p>
        <h1 className="bad-beats-title">Bad Beats Hall of Fame</h1>
      </header>

      <main className="bad-beats-main">
        {loading ? (
          <p className="bad-beats-empty">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="bad-beats-empty">
            No bad beats enshrined yet. Tap + to add the first one.
          </p>
        ) : (
          <ul className="bad-beats-list">
            {entries.map((e) => (
              <li key={e.id} className="bad-beat-card">
                <button
                  type="button"
                  className="bad-beat-delete board-delete"
                  onClick={() => remove(e.id)}
                  aria-label="Remove entry"
                >
                  &times;
                </button>
                <p className="bad-beat-date">{formatBadBeatEntryWhen(e)}</p>
                {isBadBeatLegacy(e) ? (
                  <>
                    <p className="bad-beat-legacy-tag">Older text entry</p>
                    <div className="bad-beat-block">
                      <span className="bad-beat-label">Players</span>
                      <p className="bad-beat-text">{e.players}</p>
                    </div>
                    <div className="bad-beat-block">
                      <span className="bad-beat-label">Hands</span>
                      <p className="bad-beat-text">{e.hands}</p>
                    </div>
                    <div className="bad-beat-block">
                      <span className="bad-beat-label">Flop</span>
                      <p className="bad-beat-text">{e.flop}</p>
                    </div>
                  </>
                ) : (
                  <BadBeatPokerTable
                    readOnly
                    compact
                    seats={seatsArrayFromRows(e.seats)}
                    board={e.board}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      <button type="button" className="fab" onClick={openModal} aria-label="Add bad beat">
        +
      </button>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => !submitting && !picker && closeModal()}>
          <form
            className="modal-card bad-beats-modal bad-beats-modal-wide"
            onClick={(ev) => ev.stopPropagation()}
            onSubmit={handleSubmit}
          >
            <h3 className="modal-title">Enshrine a bad beat</h3>
            <p className="bad-beats-modal-hint">
              Tap <strong>Add</strong> on a seat: enter a name and pick two hole cards. Tap the{" "}
              <strong>+</strong> in the middle for each flop / turn / river card (five total).
            </p>

            <div className="bb-modal-date-row">
              <label className="modal-label">
                Bad beat night
                <input
                  className="modal-input"
                  type="date"
                  value={beatDate}
                  onChange={(ev) => setBeatDate(ev.target.value)}
                />
              </label>
              <button
                type="button"
                className="modal-btn modal-btn-cancel"
                onClick={() => setBeatDate(sessionCalendarDateISO())}
              >
                Tonight
              </button>
            </div>

            <BadBeatPokerTable
              readOnly={false}
              seats={seats}
              board={board}
              onEmptySeatClick={(seat) => {
                if (seats[seat]) return;
                setSeatForm({ seat, name: "", hole: ["", ""] });
                setPicker(null);
              }}
              onRemoveSeat={(seat) => {
                setSeats((prev) => {
                  const n = [...prev];
                  n[seat] = null;
                  return n;
                });
                setSeatForm((f) => (f?.seat === seat ? null : f));
              }}
              onBoardSlotClick={(index) => {
                setPicker({ kind: "board", index });
                setSeatForm(null);
              }}
            />

            {seatForm ? (
              <div className="bb-seat-form">
                <p className="bb-seat-form-title">
                  Seat {seatForm.seat + 1} &mdash; new player
                </p>
                <label className="modal-label">
                  Name
                  <input
                    className="modal-input"
                    type="text"
                    autoComplete="off"
                    placeholder="Player name"
                    value={seatForm.name}
                    onChange={(ev) =>
                      setSeatForm((f) => (f ? { ...f, name: ev.target.value } : f))
                    }
                  />
                </label>
                <div className="bb-seat-form-holes">
                  <span className="bad-beat-label">Hole cards</span>
                  <div className="bb-seat-form-hole-row">
                    <button
                      type="button"
                      className="bb-board-slot bb-board-slot--inline"
                      onClick={() => setPicker({ kind: "hole", seat: seatForm.seat, which: 0 })}
                    >
                      {seatForm.hole[0] ? (
                        <CardFace code={seatForm.hole[0]} size="md" />
                      ) : (
                        <span>+</span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="bb-board-slot bb-board-slot--inline"
                      onClick={() => setPicker({ kind: "hole", seat: seatForm.seat, which: 1 })}
                    >
                      {seatForm.hole[1] ? (
                        <CardFace code={seatForm.hole[1]} size="md" />
                      ) : (
                        <span>+</span>
                      )}
                    </button>
                  </div>
                </div>
                <div className="bb-seat-form-actions">
                  <button
                    type="button"
                    className="modal-btn modal-btn-cancel"
                    onClick={() => setSeatForm(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="modal-btn modal-btn-submit"
                    onClick={() => {
                      const name = seatForm.name.trim();
                      const h0 = parseBadBeatCard(seatForm.hole[0]);
                      const h1 = parseBadBeatCard(seatForm.hole[1]);
                      if (!name || !h0 || !h1) return;
                      setSeats((prev) => {
                        const n = [...prev];
                        n[seatForm.seat] = { name, hole: [h0, h1] };
                        return n;
                      });
                      setSeatForm(null);
                    }}
                    disabled={
                      !seatForm.name.trim() ||
                      !parseBadBeatCard(seatForm.hole[0]) ||
                      !parseBadBeatCard(seatForm.hole[1])
                    }
                  >
                    Place at seat
                  </button>
                </div>
              </div>
            ) : null}

            {error ? <p className="bad-beats-form-error">{error}</p> : null}

            <div className="bad-beats-modal-actions">
              <button
                type="button"
                className="modal-btn modal-btn-cancel"
                disabled={submitting}
                onClick={closeModal}
              >
                Cancel
              </button>
              <button type="submit" className="modal-btn modal-btn-submit" disabled={submitting}>
                {submitting ? "Saving…" : "Add to hall"}
              </button>
            </div>
          </form>

          {picker ? (
            <CardPickerOverlay
              used={usedForPicker(seats, board, picker, pendingForPicker)}
              onPick={handlePick}
              onClose={() => setPicker(null)}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
