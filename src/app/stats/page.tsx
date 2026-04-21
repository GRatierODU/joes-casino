"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type PlayerStats = {
  playerId?: string;
  name: string;
  totalSessions: number;
  totalBuyin: number;
  totalCashout: number;
  totalPL: number;
  avgBuyin: number;
  avgPL: number;
  bestSession: number;
  worstSession: number;
};

type SessionWithDate = {
  name: string;
  buyin: number;
  cashout: number;
  table: number;
  paid?: boolean;
  playerId?: string;
  date: string;
};

function fmtDollars(n: number): string {
  return (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function StatsPage() {
  const [allStats, setAllStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<{ key: string; label: string } | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [playerSessions, setPlayerSessions] = useState<SessionWithDate[]>([]);
  const [loadingPlayer, setLoadingPlayer] = useState(false);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setAllStats(d.stats ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openPlayer = useCallback(async (playerId: string | undefined, label: string) => {
    const key = playerId ?? `legacy:${label}`;
    setSelectedPlayer({ key, label });
    setLoadingPlayer(true);
    try {
      const q = playerId
        ? `playerId=${encodeURIComponent(playerId)}`
        : `legacyName=${encodeURIComponent(label)}`;
      const res = await fetch(`/api/stats?${q}`);
      const data = await res.json();
      setPlayerStats(data.stats ?? null);
      setPlayerSessions(data.sessions ?? []);
    } catch {}
    setLoadingPlayer(false);
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
        <Link href="/tournaments" className="tables-nav-link">Tournaments</Link>
      </nav>

      <header className="tables-header">
        <h1 className="tables-title">Player Stats</h1>
        <p className="tables-sub">Lifetime stats from session history</p>
      </header>

      <div className="stats-container">
        {loading ? (
          <p className="history-empty">Loading...</p>
        ) : selectedPlayer === null ? (
          <>
            {allStats.length === 0 ? (
              <p className="history-empty">No session data yet. Play some games first!</p>
            ) : (
              <div className="stats-table">
                <div className="stats-row stats-row-header">
                  <span className="stats-col-name">Player</span>
                  <span className="stats-col">Sessions</span>
                  <span className="stats-col">Total Buy-in</span>
                  <span className="stats-col">Total Cashout</span>
                  <span className="stats-col">Total P/L</span>
                </div>
                {allStats.map((s) => {
                  const rowKey = s.playerId ?? `legacy:${s.name}`;
                  return (
                    <button
                      key={rowKey}
                      className="stats-row stats-row-clickable"
                      onClick={() => openPlayer(s.playerId, s.name)}
                    >
                      <span className="stats-col-name">{s.name}</span>
                      <span className="stats-col">{s.totalSessions}</span>
                      <span className="stats-col">{fmtDollars(s.totalBuyin)}</span>
                      <span className="stats-col">{fmtDollars(s.totalCashout)}</span>
                      <span className={`stats-col ${s.totalPL >= 0 ? "session-profit" : "session-loss"}`}>
                        {s.totalPL >= 0 ? "+" : ""}{fmtDollars(s.totalPL)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="stats-detail">
            <button className="history-back" onClick={() => { setSelectedPlayer(null); setPlayerStats(null); setPlayerSessions([]); }}>
              &larr; All Players
            </button>

            {loadingPlayer ? (
              <p className="history-empty">Loading...</p>
            ) : playerStats ? (
              <>
                <h2 className="stats-player-name">{selectedPlayer.label}</h2>
                <div className="stats-cards">
                  <div className="stat-card">
                    <span className="stat-card-label">Sessions</span>
                    <span className="stat-card-value">{playerStats.totalSessions}</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card-label">Total P/L</span>
                    <span className={`stat-card-value ${playerStats.totalPL >= 0 ? "session-profit" : "session-loss"}`}>
                      {playerStats.totalPL >= 0 ? "+" : ""}{fmtDollars(playerStats.totalPL)}
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card-label">Total Buy-in</span>
                    <span className="stat-card-value">{fmtDollars(playerStats.totalBuyin)}</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card-label">Total Cashout</span>
                    <span className="stat-card-value">{fmtDollars(playerStats.totalCashout)}</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card-label">Avg Buy-in</span>
                    <span className="stat-card-value">{fmtDollars(playerStats.avgBuyin)}</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card-label">Avg P/L</span>
                    <span className={`stat-card-value ${playerStats.avgPL >= 0 ? "session-profit" : "session-loss"}`}>
                      {playerStats.avgPL >= 0 ? "+" : ""}{fmtDollars(playerStats.avgPL)}
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card-label">Best Session</span>
                    <span className="stat-card-value session-profit">+{fmtDollars(playerStats.bestSession)}</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card-label">Worst Session</span>
                    <span className="stat-card-value session-loss">{fmtDollars(playerStats.worstSession)}</span>
                  </div>
                </div>

                <h3 className="stats-sessions-title">Session History</h3>
                {playerSessions.length === 0 ? (
                  <p className="history-empty">No sessions found.</p>
                ) : (
                  <div className="stats-table">
                    <div className="stats-row stats-row-header">
                      <span className="stats-col-name">Date</span>
                      <span className="stats-col">Buy-in</span>
                      <span className="stats-col">Cashout</span>
                      <span className="stats-col">P/L</span>
                    </div>
                    {playerSessions.map((s, i) => {
                      const pl = s.cashout - s.buyin;
                      return (
                        <div key={i} className="stats-row">
                          <span className="stats-col-name">{fmtDate(s.date)}</span>
                          <span className="stats-col">{fmtDollars(s.buyin)}</span>
                          <span className="stats-col">{fmtDollars(s.cashout)}</span>
                          <span className={`stats-col ${pl >= 0 ? "session-profit" : "session-loss"}`}>
                            {pl >= 0 ? "+" : ""}{fmtDollars(pl)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <p className="history-empty">No data found for this player.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
