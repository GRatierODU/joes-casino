"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { playerDisplayName, playerFormalShortName } from "@/lib/players";

type PlayerStats = {
  playerId?: string;
  name: string;
  picture?: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
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

function StatsAvatar({
  url,
  label,
  size = "row",
}: {
  url?: string;
  label: string;
  size?: "row" | "heading" | "hero";
}) {
  const initial = (label.trim().charAt(0) || "?").toUpperCase();
  const cls =
    size === "hero"
      ? "stats-pfp stats-pfp-hero"
      : size === "heading"
        ? "stats-pfp stats-pfp-lg"
        : "stats-pfp";
  if (url) {
    return <img className={cls} src={url} alt="" />;
  }
  return (
    <span className={`${cls} stats-pfp-placeholder`} aria-hidden>
      {initial}
    </span>
  );
}

function PencilIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export default function StatsPage() {
  const [allStats, setAllStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<{
    key: string;
    label: string;
    picture?: string;
  } | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [playerSessions, setPlayerSessions] = useState<SessionWithDate[]>([]);
  const [loadingPlayer, setLoadingPlayer] = useState(false);
  const [playerEditOpen, setPlayerEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    picture: "",
  });
  const [editError, setEditError] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setAllStats(d.stats ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openPlayer = useCallback(async (playerId: string | undefined, label: string, picture?: string) => {
    const key = playerId ?? `legacy:${label}`;
    setSelectedPlayer({ key, label, picture });
    setLoadingPlayer(true);
    try {
      const q = playerId
        ? `playerId=${encodeURIComponent(playerId)}`
        : `legacyName=${encodeURIComponent(label)}`;
      const res = await fetch(`/api/stats?${q}`);
      const data = await res.json();
      const d = data.stats as PlayerStats | null;
      setPlayerStats(d ?? null);
      setPlayerSessions(data.sessions ?? []);
      if (d && playerId && d.firstName != null && d.lastName != null) {
        setSelectedPlayer({
          key,
          label: playerDisplayName({
            firstName: d.firstName,
            lastName: d.lastName,
            nickname: d.nickname,
          }),
          picture: d.picture ?? picture,
        });
      } else if (d) {
        setSelectedPlayer({ key, label, picture: d.picture ?? picture });
      }
    } catch {}
    setLoadingPlayer(false);
  }, []);

  const refreshListStats = useCallback(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setAllStats(d.stats ?? []))
      .catch(() => {});
  }, []);

  const openPlayerEdit = useCallback(() => {
    if (!playerStats?.playerId) return;
    setEditError("");
    setEditForm({
      firstName: playerStats.firstName ?? "",
      lastName: playerStats.lastName ?? "",
      nickname: playerStats.nickname ?? "",
      picture: playerStats.picture ?? "",
    });
    setPlayerEditOpen(true);
  }, [playerStats]);

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
        <p className="tables-sub">
          Cash game totals from table sessions. Everyone on Manage Players is listed; no sessions yet shows as zeros.
        </p>
      </header>

      <div className="stats-container">
        {loading ? (
          <p className="history-empty">Loading...</p>
        ) : selectedPlayer === null ? (
          <>
            {allStats.length === 0 ? (
              <p className="history-empty">No players in the roster yet. Add them from Live Tables → Manage Players.</p>
            ) : (
              <div className="stats-table">
                <div className="stats-row stats-row-header">
                  <span className="stats-col-name stats-col-name-with-pfp">
                    <span className="stats-pfp-spacer" aria-hidden />
                    Player
                  </span>
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
                      onClick={() => openPlayer(s.playerId, s.name, s.picture)}
                    >
                      <span className="stats-col-name stats-col-name-with-pfp">
                        <StatsAvatar url={s.picture} label={s.name} />
                        <span className="stats-name-text">{s.name}</span>
                      </span>
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
            <button
              className="history-back"
              onClick={() => {
                setPlayerEditOpen(false);
                setSelectedPlayer(null);
                setPlayerStats(null);
                setPlayerSessions([]);
              }}
            >
              &larr; All Players
            </button>

            {loadingPlayer ? (
              <p className="history-empty">Loading...</p>
            ) : playerStats ? (
              <>
                <div className="stats-player-hero">
                  <StatsAvatar
                    size="hero"
                    url={playerStats.picture ?? selectedPlayer.picture}
                    label={
                      playerStats.playerId && playerStats.firstName != null
                        ? playerDisplayName({
                            firstName: playerStats.firstName,
                            lastName: playerStats.lastName ?? "",
                            nickname: playerStats.nickname,
                          })
                        : selectedPlayer.label
                    }
                  />
                  <div className="stats-player-title-wrap">
                    {playerStats.playerId &&
                    playerStats.firstName != null &&
                    playerStats.lastName != null ? (
                      <>
                        {playerStats.nickname?.trim() ? (
                          <>
                            <p className="stats-player-formal-line">
                              {playerFormalShortName({
                                firstName: playerStats.firstName,
                                lastName: playerStats.lastName,
                              })}
                            </p>
                            <div className="stats-player-nick-row">
                              <span className="stats-player-nick-main">{playerStats.nickname.trim()}</span>
                            </div>
                          </>
                        ) : (
                          <div className="stats-player-nick-row">
                            <span className="stats-player-nick-main">
                              {playerFormalShortName({
                                firstName: playerStats.firstName,
                                lastName: playerStats.lastName,
                              })}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <h2 className="stats-player-name stats-player-name-legacy">{selectedPlayer.label}</h2>
                    )}
                  </div>
                </div>

                {playerStats.playerId &&
                  playerStats.firstName != null &&
                  playerStats.lastName != null && (
                    <button
                      type="button"
                      className="fab fab-pencil"
                      aria-label="Edit player"
                      onClick={openPlayerEdit}
                    >
                      <PencilIcon />
                    </button>
                  )}

                {playerEditOpen && playerStats.playerId && (
                  <div
                    className="modal-backdrop"
                    onClick={() => {
                      if (!editSubmitting) setPlayerEditOpen(false);
                    }}
                  >
                    <div className="modal-card manage-players-card" onClick={(e) => e.stopPropagation()}>
                      <div className="history-header">
                        <h3 className="modal-title">Edit player</h3>
                        <button
                          type="button"
                          className="history-close"
                          disabled={editSubmitting}
                          onClick={() => setPlayerEditOpen(false)}
                        >
                          &times;
                        </button>
                      </div>
                      <label className="modal-label">
                        First name
                        <input
                          className="modal-input"
                          value={editForm.firstName}
                          onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                        />
                      </label>
                      <label className="modal-label">
                        Last name
                        <input
                          className="modal-input"
                          value={editForm.lastName}
                          onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                        />
                      </label>
                      <label className="modal-label">
                        Nickname <span style={{ textTransform: "none", letterSpacing: "0" }}>(optional)</span>
                        <input
                          className="modal-input"
                          value={editForm.nickname}
                          onChange={(e) => setEditForm((f) => ({ ...f, nickname: e.target.value }))}
                        />
                      </label>
                      <label className="modal-label">
                        Picture URL <span style={{ textTransform: "none", letterSpacing: "0" }}>(optional)</span>
                        <input
                          className="modal-input"
                          type="url"
                          value={editForm.picture}
                          onChange={(e) => setEditForm((f) => ({ ...f, picture: e.target.value }))}
                        />
                      </label>
                      {editError ? (
                        <p style={{ color: "#ef4444", fontSize: "0.85rem", margin: 0 }}>{editError}</p>
                      ) : null}
                      <div className="modal-actions">
                        <button
                          type="button"
                          className="modal-btn modal-btn-cancel"
                          disabled={editSubmitting}
                          onClick={() => setPlayerEditOpen(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="modal-btn modal-btn-submit"
                          disabled={editSubmitting}
                          onClick={async () => {
                            if (!playerStats.playerId) return;
                            if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
                              setEditError("First and last name are required.");
                              return;
                            }
                            setEditError("");
                            setEditSubmitting(true);
                            try {
                              const res = await fetch("/api/players", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  id: playerStats.playerId,
                                  firstName: editForm.firstName.trim(),
                                  lastName: editForm.lastName.trim(),
                                  nickname: editForm.nickname.trim() || null,
                                  picture: editForm.picture.trim() || null,
                                }),
                              });
                              const d = await res.json();
                              if (res.ok) {
                                setPlayerEditOpen(false);
                                refreshListStats();
                                const q = `playerId=${encodeURIComponent(playerStats.playerId)}`;
                                const res2 = await fetch(`/api/stats?${q}`);
                                const data2 = await res2.json();
                                const d2 = data2.stats as PlayerStats | null;
                                setPlayerStats(d2 ?? null);
                                setPlayerSessions(data2.sessions ?? []);
                                if (d2?.firstName != null && d2.lastName != null) {
                                  setSelectedPlayer({
                                    key:
                                      selectedPlayer?.key ??
                                      `id:${playerStats.playerId}`,
                                    label: playerDisplayName({
                                      firstName: d2.firstName,
                                      lastName: d2.lastName,
                                      nickname: d2.nickname,
                                    }),
                                    picture: d2.picture,
                                  });
                                }
                              } else {
                                setEditError(d.error || "Failed to save.");
                              }
                            } catch {
                              setEditError("Network error.");
                            }
                            setEditSubmitting(false);
                          }}
                        >
                          {editSubmitting ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

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
