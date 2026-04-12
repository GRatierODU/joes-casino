"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";

type Entry = { date: string; name: string; amount: number };

const fallbackWinners: Entry[] = [
  { date: "2/18", name: "Wes", amount: 160 },
  { date: "4/8", name: "Ethan C", amount: 157.75 },
  { date: "2/1", name: "Joe", amount: 139.25 },
  { date: "2/22", name: "Wes", amount: 122.75 },
  { date: "3/10", name: "Ecass", amount: 109.50 },
  { date: "5/26", name: "Kai", amount: 107.50 },
  { date: "3/5", name: "Joe", amount: 100 },
  { date: "3/4", name: "Semen", amount: 86.50 },
  { date: "12/4", name: "Josh Scherer", amount: 86 },
  { date: "10/19", name: "Seaford", amount: 85.25 },
  { date: "2/9", name: "Joe", amount: 85 },
  { date: "10/29", name: "Joe", amount: 79.50 },
  { date: "1/28", name: "Stephen", amount: 79 },
  { date: "1/24", name: "Joe", amount: 78.50 },
  { date: "3/29", name: "Wes", amount: 77.75 },
  { date: "2/6", name: "Seaford", amount: 75 },
  { date: "1/28", name: "Wes", amount: 74.25 },
  { date: "4/6", name: "Ethan", amount: 73.25 },
  { date: "2/11", name: "Wes", amount: 72.50 },
  { date: "1/29", name: "Harrison", amount: 70.75 },
  { date: "2/18", name: "Jeremy", amount: 70.75 },
  { date: "4/2", name: "Troy", amount: 64 },
  { date: "3/11", name: "Harrison", amount: 62.25 },
  { date: "2/11", name: "Seaford", amount: 61 },
  { date: "10/16", name: "Joe", amount: 59.50 },
  { date: "11/12", name: "Harrison", amount: 57 },
];

const fallbackLosers: Entry[] = [
  { date: "2/22", name: "Kai", amount: -80 },
  { date: "2/1", name: "Frenchie", amount: -76 },
  { date: "2/1", name: "Wes", amount: -71 },
  { date: "3/11", name: "Wes", amount: -70 },
  { date: "2/9", name: "Ethan", amount: -65 },
  { date: "3/11", name: "Joe", amount: -60 },
  { date: "3/5", name: "Wes", amount: -60 },
  { date: "3/10", name: "Joe", amount: -58.75 },
  { date: "2/18", name: "Harrison", amount: -55 },
  { date: "4/2", name: "Kai", amount: -50 },
  { date: "2/18", name: "Kai", amount: -50 },
  { date: "3/29", name: "Kai", amount: -50 },
  { date: "4/8", name: "Joe", amount: -50 },
  { date: "3/10", name: "Jerbear", amount: -50 },
  { date: "3/4", name: "Ethan C", amount: -47.25 },
  { date: "3/26", name: "Nathan", amount: -45 },
  { date: "4/6", name: "Wes", amount: -42.25 },
  { date: "3/5", name: "Kai", amount: -41.25 },
  { date: "1/26", name: "Seaford", amount: -40 },
  { date: "4/2", name: "Kai", amount: -40 },
  { date: "4/6", name: "Kai", amount: -40 },
  { date: "3/8", name: "Wes", amount: -40 },
  { date: "4/2", name: "Ecass", amount: -40 },
  { date: "2/18", name: "Avery", amount: -40 },
  { date: "3/8", name: "Kai", amount: -40 },
  { date: "4/2", name: "Kai", amount: -40 },
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

  const handleSubmit = useCallback(async () => {
    const amt = parseFloat(formAmount);
    if (!formDate.trim() || !formName.trim() || isNaN(amt) || amt === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board,
          date: formDate.trim(),
          name: formName.trim(),
          amount: amt,
        }),
      });
      if (res.ok) {
        const data: { winners: Entry[]; losers: Entry[] } = await res.json();
        setWinnerList(data.winners);
        setLoserList(data.losers);
        setModalOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  }, [board, formDate, formName, formAmount]);

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
              {winnerList.map((p, i) => (
                <li key={`w-${i}`} className="board-row">
                  <span className="board-date">{p.date}</span>
                  <span className="board-name">{p.name}</span>
                  <span className="board-amount green">{fmt(p.amount)}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="board-col">
            <p className="board-label board-label-red">All-Time Standings</p>
            <h2 className="board-title">Top Losers</h2>
            <ol className="board-list">
              {loserList.map((p, i) => (
                <li key={`l-${i}`} className="board-row">
                  <span className="board-date">{p.date}</span>
                  <span className="board-name">{p.name}</span>
                  <span className="board-amount red">{fmt(p.amount)}</span>
                </li>
              ))}
            </ol>
          </div>
        </RevealSection>
      </section>

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

      {/* ───── CLOSER ───── */}
      <section className="closer-section">
        <RevealSection>
          <p className="closer-label">&clubs; &diams; &hearts; &spades;</p>
          <h2 className="closer-title">See you next Thursday.</h2>
          <p className="closer-sub">25¢/50¢ · 50¢ Ante · Seven-Deuce</p>
        </RevealSection>
      </section>
    </>
  );
}
