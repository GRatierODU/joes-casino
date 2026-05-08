"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

type Entry = { date: string; name: string; amount: number };

const fallbackWinners: Entry[] = [
  { date: "2/18/26", name: "Wes", amount: 160 },
  { date: "4/8/26", name: "Ethan C", amount: 157.75 },
  { date: "2/1/26", name: "Joe", amount: 139.25 },
  { date: "2/22/26", name: "Wes", amount: 122.75 },
  { date: "3/10/26", name: "Ecass", amount: 109.50 },
  { date: "5/26/25", name: "Kai", amount: 107.50 },
  { date: "3/5/26", name: "Joe", amount: 100 },
  { date: "3/4/26", name: "Semen", amount: 86.50 },
  { date: "12/4/25", name: "Josh Scherer", amount: 86 },
  { date: "10/19/25", name: "Seaford", amount: 85.25 },
  { date: "2/9/26", name: "Joe", amount: 85 },
  { date: "10/29/25", name: "Joe", amount: 79.50 },
  { date: "1/28/26", name: "Stephen", amount: 79 },
  { date: "1/24/26", name: "Joe", amount: 78.50 },
  { date: "3/29/26", name: "Wes", amount: 77.75 },
  { date: "2/6/26", name: "Seaford", amount: 75 },
  { date: "1/28/26", name: "Wes", amount: 74.25 },
  { date: "4/6/26", name: "Ethan", amount: 73.25 },
  { date: "2/11/26", name: "Wes", amount: 72.50 },
  { date: "1/29/26", name: "Harrison", amount: 70.75 },
  { date: "2/18/26", name: "Jeremy", amount: 70.75 },
  { date: "4/2/26", name: "Troy", amount: 64 },
  { date: "3/11/26", name: "Harrison", amount: 62.25 },
  { date: "2/11/26", name: "Seaford", amount: 61 },
  { date: "10/16/25", name: "Joe", amount: 59.50 },
  { date: "11/12/25", name: "Harrison", amount: 57 },
];

const fallbackLosers: Entry[] = [
  { date: "2/22/26", name: "Kai", amount: -80 },
  { date: "2/1/26", name: "Frenchie", amount: -76 },
  { date: "2/1/26", name: "Wes", amount: -71 },
  { date: "3/11/26", name: "Wes", amount: -70 },
  { date: "2/9/26", name: "Ethan", amount: -65 },
  { date: "3/11/26", name: "Joe", amount: -60 },
  { date: "3/5/26", name: "Wes", amount: -60 },
  { date: "3/10/26", name: "Joe", amount: -58.75 },
  { date: "2/18/26", name: "Harrison", amount: -55 },
  { date: "4/2/26", name: "Kai", amount: -50 },
  { date: "2/18/26", name: "Kai", amount: -50 },
  { date: "3/29/26", name: "Kai", amount: -50 },
  { date: "4/8/26", name: "Joe", amount: -50 },
  { date: "3/10/26", name: "Jerbear", amount: -50 },
  { date: "3/4/26", name: "Ethan C", amount: -47.25 },
  { date: "3/26/26", name: "Nathan", amount: -45 },
  { date: "4/6/26", name: "Wes", amount: -42.25 },
  { date: "3/5/26", name: "Kai", amount: -41.25 },
  { date: "1/26/26", name: "Seaford", amount: -40 },
  { date: "4/2/26", name: "Kai", amount: -40 },
  { date: "4/6/26", name: "Kai", amount: -40 },
  { date: "3/8/26", name: "Wes", amount: -40 },
  { date: "4/2/26", name: "Ecass", amount: -40 },
  { date: "2/18/26", name: "Avery", amount: -40 },
  { date: "3/8/26", name: "Kai", amount: -40 },
  { date: "4/2/26", name: "Kai", amount: -40 },
];

const fmt = (n: number) =>
  (n < 0 ? "-" : "+") +
  "$" +
  Math.abs(n).toLocaleString("en-US");

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("revealed");
          io.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function RevealSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`reveal-up ${className}`}>
      {children}
    </div>
  );
}

export default function Home() {
  const [phase, setPhase] = useState<"loading" | "transition" | "done">(
    "loading"
  );
  const [winnerList, setWinnerList] = useState<Entry[]>(fallbackWinners);
  const [loserList, setLoserList] = useState<Entry[]>(fallbackLosers);
  const [modalOpen, setModalOpen] = useState(false);
  const [board, setBoard] = useState<"winner" | "loser">("winner");
  const [formDate, setFormDate] = useState("");
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    document.body.style.overflow = "hidden";
    const t1 = setTimeout(() => setPhase("transition"), 1800);
    const t2 = setTimeout(() => {
      setPhase("done");
      document.body.style.overflow = "";
    }, 3200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data: { winners: Entry[]; losers: Entry[] }) => {
        setWinnerList(data.winners);
        setLoserList(data.losers);
      })
      .catch(() => {});
  }, []);

  const openModal = useCallback(() => {
    setFormDate("");
    setFormName("");
    setFormAmount("");
    setBoard("winner");
    setModalOpen(true);
  }, []);

  const [rivalry, setRivalry] = useState({ avery: 0, wes: 35 });
  const [rivalryEdit, setRivalryEdit] = useState<{ player: "avery" | "wes"; value: string } | null>(null);

  useEffect(() => {
    fetch("/api/rivalry")
      .then((r) => r.json())
      .then((d: { avery: number; wes: number }) => setRivalry(d))
      .catch(() => {});
  }, []);

  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{
    board: "winner" | "loser";
    index: number;
    entry: Entry;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSubmit = useCallback(async () => {
    setError("");
    const amt = parseFloat(formAmount);
    const dateParts = formDate.trim().split("/");
    if (
      dateParts.length !== 2 ||
      !dateParts[0] ||
      !dateParts[1] ||
      !formName.trim() ||
      isNaN(amt) ||
      amt === 0
    ) {
      setError("Please fill in all fields (date as M/DD).");
      return;
    }

    const dateStr = `${parseInt(dateParts[0])}/${parseInt(dateParts[1])}`;

    setSubmitting(true);
    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board,
          date: dateStr,
          name: formName.trim(),
          amount: amt,
        }),
      });
      if (res.ok) {
        const data: { winners: Entry[]; losers: Entry[] } = await res.json();
        setWinnerList(data.winners);
        setLoserList(data.losers);
        setModalOpen(false);
      } else {
        const errBody = await res.text();
        console.error("API error:", res.status, errBody);
        setError("Failed to save. Please try again.");
      }
    } catch (e) {
      console.error("Network error:", e);
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [board, formDate, formName, formAmount]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/leaderboard", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board: confirmDelete.board,
          index: confirmDelete.index,
        }),
      });
      if (res.ok) {
        const data: { winners: Entry[]; losers: Entry[] } = await res.json();
        setWinnerList(data.winners);
        setLoserList(data.losers);
        setConfirmDelete(null);
      }
    } catch (e) {
      console.error("Delete error:", e);
    } finally {
      setDeleting(false);
    }
  }, [confirmDelete]);

  return (
    <>
      {/* ───── LOADING OVERLAY ───── */}
      <div
        className={`loader-overlay ${
          phase === "transition" || phase === "done" ? "loader-exit" : ""
        } ${phase === "done" ? "loader-gone" : ""}`}
      >
        <div className="loader-logo-wrap">
          <Image
            src="/logo.svg"
            alt="Joe's Casino"
            width={500}
            height={500}
            priority
            className="loader-logo"
          />
          <div className="loader-ring" />
        </div>
      </div>

      {/* ───── HERO ───── */}
      <section className="hero-section">
        <div className="hero-glow" />
        <div className={`hero-content ${phase === "done" ? "hero-visible" : ""}`}>
          <p className="hero-label">Every Thursday Night And More</p>
          <Image
            src="/logo.svg"
            alt="Joe's Casino"
            width={420}
            height={420}
            priority
            className="hero-logo"
          />
          <p className="hero-sub">
            The official leaderboard for the best ODU home game.
          </p>
          <div className="hero-links">
            <Link href="/tables" className="home-tables-link">
              Live Tables &rarr;
            </Link>
            <Link href="/tournaments" className="home-tables-link">
              Tournaments &rarr;
            </Link>
            <Link href="/stats" className="home-tables-link">
              Player Stats &rarr;
            </Link>
            <Link href="/bad-beats" className="home-tables-link">
              Bad Beats Hall of Fame &rarr;
            </Link>
          </div>
          <div className="hero-scroll-cue">
            <span />
          </div>
        </div>
        <div className="hero-suits" aria-hidden="true">
          <span className="suit suit-1">&spades;</span>
          <span className="suit suit-2">&hearts;</span>
          <span className="suit suit-3">&diams;</span>
          <span className="suit suit-4">&clubs;</span>
        </div>
      </section>

      {/* ───── LEADERBOARDS ───── */}
      <section className="boards-section">
        <RevealSection className="boards-grid">
          <div className="board-col">
            <p className="board-label board-label-green">All-Time Standings</p>
            <h2 className="board-title">Top Winners</h2>
            <ol className="board-list">
              {winnerList.slice(0, 25).map((p, i) => (
                <li key={`w-${i}`} className="board-row">
                  <span className="board-date">{p.date}</span>
                  <span className="board-name">{p.name}</span>
                  <span className="board-amount green">{fmt(p.amount)}</span>
                  <button
                    className="board-delete"
                    onClick={() => setConfirmDelete({ board: "winner", index: i, entry: p })}
                    aria-label={`Remove ${p.name}`}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div className="board-col">
            <p className="board-label board-label-red">All-Time Standings</p>
            <h2 className="board-title">Top Losers</h2>
            <ol className="board-list">
              {loserList.slice(0, 25).map((p, i) => (
                <li key={`l-${i}`} className="board-row">
                  <span className="board-date">{p.date}</span>
                  <span className="board-name">{p.name}</span>
                  <span className="board-amount red">{fmt(p.amount)}</span>
                  <button
                    className="board-delete"
                    onClick={() => setConfirmDelete({ board: "loser", index: i, entry: p })}
                    aria-label={`Remove ${p.name}`}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </RevealSection>
      </section>

      {/* ───── RIVALRY TRACKER ───── */}
      <section className="rivalry-section">
        <RevealSection>
          <p className="rivalry-label">Head to Head</p>
          <h2 className="rivalry-title">Avery vs Wes</h2>
          <div className="rivalry-card">
            <div className="rivalry-player rivalry-left">
              <span className="rivalry-name">Avery</span>
              <button
                className={`rivalry-score ${rivalry.avery > rivalry.wes ? "rivalry-score-lead" : ""}`}
                onClick={() => setRivalryEdit({ player: "avery", value: String(rivalry.avery) })}
              >
                ${rivalry.avery}
              </button>
            </div>
            <div className="rivalry-divider">
              <span className="rivalry-vs">VS</span>
            </div>
            <div className="rivalry-player rivalry-right">
              <button
                className={`rivalry-score ${rivalry.wes > rivalry.avery ? "rivalry-score-lead" : ""}`}
                onClick={() => setRivalryEdit({ player: "wes", value: String(rivalry.wes) })}
              >
                ${rivalry.wes}
              </button>
              <span className="rivalry-name">Wes</span>
            </div>
          </div>
        </RevealSection>
      </section>

      {/* ───── RIVALRY EDIT MODAL ───── */}
      {rivalryEdit && (
        <div className="modal-backdrop" onClick={() => setRivalryEdit(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              Edit {rivalryEdit.player === "avery" ? "Avery" : "Wes"}&apos;s Score
            </h3>
            <label className="modal-label">
              Amount ($)
              <input
                className="modal-input"
                type="number"
                min="0"
                value={rivalryEdit.value}
                onChange={(e) => setRivalryEdit({ ...rivalryEdit, value: e.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setRivalryEdit(null)}>
                Cancel
              </button>
              <button
                className="modal-btn modal-btn-submit"
                disabled={submitting}
                onClick={async () => {
                  const val = parseFloat(rivalryEdit.value);
                  if (isNaN(val) || val < 0) return;
                  setSubmitting(true);
                  try {
                    const res = await fetch("/api/rivalry", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ [rivalryEdit.player]: val }),
                    });
                    if (res.ok) {
                      setRivalry(await res.json());
                      setRivalryEdit(null);
                    }
                  } catch {}
                  setSubmitting(false);
                }}
              >
                {submitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── ADD ENTRY BUTTON ───── */}
      <button className="fab" onClick={openModal} aria-label="Add entry">
        +
      </button>

      {/* ───── MODAL ───── */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Add Entry</h3>

            <div className="modal-toggle-row">
              <button
                className={`modal-toggle ${board === "winner" ? "modal-toggle-active-green" : ""}`}
                onClick={() => setBoard("winner")}
              >
                Winner
              </button>
              <button
                className={`modal-toggle ${board === "loser" ? "modal-toggle-active-red" : ""}`}
                onClick={() => setBoard("loser")}
              >
                Loser
              </button>
            </div>

            <label className="modal-label">
              Date
              <input
                className="modal-input"
                type="text"
                placeholder="MM/DD/YY"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </label>

            <label className="modal-label">
              Name
              <input
                className="modal-input"
                type="text"
                placeholder="Player name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </label>

            <label className="modal-label">
              Amount ($)
              <input
                className="modal-input"
                type="number"
                placeholder="e.g. 500"
                min="1"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
              />
            </label>

            {error && <p style={{ color: "#ef4444", fontSize: "0.85rem", margin: "0 0 0.5rem" }}>{error}</p>}

            <div className="modal-actions">
              <button
                className="modal-btn modal-btn-cancel"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="modal-btn modal-btn-submit"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Adding..." : "Add to Board"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── CONFIRM DELETE MODAL ───── */}
      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal-card confirm-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Remove Entry?</h3>
            <p className="confirm-detail">
              <span className="confirm-name">{confirmDelete.entry.name}</span>
              <span className="confirm-amount">
                {fmt(confirmDelete.entry.amount)}
              </span>
              <span className="confirm-date">{confirmDelete.entry.date}</span>
            </p>
            <div className="modal-actions">
              <button
                className="modal-btn modal-btn-cancel"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className="modal-btn modal-btn-delete"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── CLOSER ───── */}
      <section className="closer-section">
        <RevealSection>
          <p className="closer-label">&clubs; &diams; &hearts; &spades;</p>
          <h2 className="closer-title">See you next time.</h2>
          <p className="closer-sub">25¢/50¢ · 50¢ Ante · Seven-Deuce</p>
        </RevealSection>
      </section>
    </>
  );
}
