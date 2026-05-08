"use client";

import type { CSSProperties } from "react";
import {
  allBadBeatCardCodes,
  parseBadBeatCard,
  rankDisplay,
  suitDisplay,
  collectUsedCards,
  type BadBeatSeatRow,
} from "@/lib/badBeatCards";

/** Evenly space players on an ellipse; n=2 → top vs bottom (opposite). n=1 sits higher above the felt. */
function readonlySeatStyle(index: number, total: number): CSSProperties {
  if (total <= 0) return {};
  if (total === 1) {
    return {
      position: "absolute",
      left: "50%",
      top: "0",
      transform: "translate(-50%, -2.45rem)",
    };
  }
  const startDeg = -90;
  const step = 360 / total;
  const rad = ((startDeg + step * index) * Math.PI) / 180;
  const rx = 49;
  const ry = 60;
  return {
    position: "absolute",
    left: `${50 + rx * Math.cos(rad)}%`,
    top: `${50 + ry * Math.sin(rad)}%`,
    transform: "translate(-50%, -50%)",
  };
}

export type SeatCell = null | { name: string; hole: [string, string] };

export function CardFace({
  code,
  size = "md",
}: {
  code: string;
  size?: "sm" | "md" | "lg";
}) {
  const parsed = parseBadBeatCard(code);
  if (!parsed) {
    return (
      <span className={`bb-card bb-card--empty bb-card--${size}`} aria-hidden>
        ?
      </span>
    );
  }
  const rank = parsed[0];
  const suit = parsed[1];
  const { symbol, red } = suitDisplay(suit);
  return (
    <span
      className={`bb-card bb-card--${size} ${red ? "bb-card--red" : "bb-card--blk"}`}
      aria-label={`${rankDisplay(rank)} of ${suit}`}
    >
      <span className="bb-card-rank">{rankDisplay(rank)}</span>
      <span className="bb-card-suit" aria-hidden>
        {symbol}
      </span>
    </span>
  );
}

export type PickerTarget =
  | { kind: "board"; index: number }
  | { kind: "hole"; seat: number; which: 0 | 1 };

export function CardPickerOverlay({
  used,
  onPick,
  onClose,
}: {
  used: Set<string>;
  onPick: (code: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop modal-backdrop-top bb-picker-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pick a card"
    >
      <div className="modal-card bb-picker-card" onClick={(e) => e.stopPropagation()}>
        <div className="bb-picker-head">
          <h3 className="modal-title" style={{ margin: 0 }}>
            Pick a card
          </h3>
          <button type="button" className="modal-btn modal-btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="bb-picker-grid">
          {allBadBeatCardCodes().map((code) => {
            const taken = used.has(code);
            return (
              <button
                key={code}
                type="button"
                className={`bb-picker-cell ${taken ? "bb-picker-cell--used" : ""}`}
                disabled={taken}
                onClick={() => !taken && onPick(code)}
              >
                <CardFace code={code} size="sm" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function usedSetForPicker(
  seats: SeatCell[],
  board: [string, string, string, string, string],
  target: PickerTarget,
  pending: null | { seat: number; hole: [string, string] }
): Set<string> {
  const sRows: (null | { hole: [string, string] })[] = seats.map((cell) =>
    cell ? { hole: [...cell.hole] as [string, string] } : null
  );
  if (pending) {
    sRows[pending.seat] = { hole: [...pending.hole] };
  }
  const b = [...board] as string[];
  if (target.kind === "board") {
    b[target.index] = "";
  } else {
    const row = sRows[target.seat];
    if (row) row.hole[target.which] = "";
  }
  return collectUsedCards(sRows, b);
}

type BadBeatPokerTableProps = {
  seats: SeatCell[];
  board: [string, string, string, string, string];
  readOnly: boolean;
  onEmptySeatClick?: (seat: number) => void;
  onRemoveSeat?: (seat: number) => void;
  onBoardSlotClick?: (index: number) => void;
  compact?: boolean;
};

function OccupiedSeatBlock({
  cell,
  cardSize,
  fanHoleCards = false,
}: {
  cell: NonNullable<SeatCell>;
  cardSize: "sm" | "md";
  fanHoleCards?: boolean;
}) {
  const hole = fanHoleCards ? (
    <div className="bb-seat-hole bb-seat-hole--fan">
      <span className="bb-hole-card bb-hole-card--left">
        <CardFace code={cell.hole[0]} size={cardSize} />
      </span>
      <span className="bb-hole-card bb-hole-card--right">
        <CardFace code={cell.hole[1]} size={cardSize} />
      </span>
    </div>
  ) : (
    <div className="bb-seat-hole">
      <CardFace code={cell.hole[0]} size={cardSize} />
      <CardFace code={cell.hole[1]} size={cardSize} />
    </div>
  );
  return (
    <div className={`bb-seat-inner ${fanHoleCards ? "bb-seat-inner--plain" : ""}`}>
      <span className="bb-seat-name">{cell.name}</span>
      {hole}
    </div>
  );
}

export function BadBeatPokerTable({
  seats,
  board,
  readOnly,
  onEmptySeatClick,
  onRemoveSeat,
  onBoardSlotClick,
  compact = false,
}: BadBeatPokerTableProps) {
  const cardSize = compact ? "sm" : "md";
  const occupiedReadonly = readOnly
    ? seats
        .map((cell, si) => (cell ? { si, cell } : null))
        .filter((x): x is { si: number; cell: NonNullable<SeatCell> } => x !== null)
    : null;

  return (
    <div className={`poker-table-wrap ${compact ? "bb-table-wrap--compact" : ""}`}>
      <div
        className={`poker-table bb-poker-table ${compact ? "bb-poker-table--compact" : ""} ${readOnly ? "bb-poker-table--readonly" : ""}`}
      >
        <div className="felt bb-felt">
          {readOnly ? (
            <div className="bb-runout bb-runout--readonly" aria-label="Board runout">
              {board.map((c, i) => (
                <div key={i} className="bb-board-static">
                  {c ? <CardFace code={c} size={cardSize} /> : <span className="bb-board-static--empty">—</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="bb-runout" aria-label="Board runout">
              {board.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  className={`bb-board-slot ${!c ? "bb-board-slot--empty" : ""}`}
                  disabled={!onBoardSlotClick}
                  onClick={() => onBoardSlotClick?.(i)}
                >
                  {c ? <CardFace code={c} size={cardSize} /> : <span>+</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        {readOnly && occupiedReadonly
          ? occupiedReadonly.map(({ si, cell }, idx) => (
              <div
                key={si}
                className="bb-seat bb-seat--filled bb-ro-seat seat-occupied"
                style={readonlySeatStyle(idx, occupiedReadonly.length)}
              >
                <OccupiedSeatBlock cell={cell} cardSize={cardSize} fanHoleCards />
              </div>
            ))
          : seats.map((cell, si) => {
              const occupied = cell !== null;
              return (
                <div
                  key={si}
                  className={`seat seat-${si} bb-seat ${occupied ? "seat-occupied bb-seat--filled" : "seat-empty bb-seat--empty"}`}
                >
                  {occupied ? (
                    <>
                      {onRemoveSeat ? (
                        <button
                          type="button"
                          className="bb-seat-remove board-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveSeat(si);
                          }}
                          aria-label={`Remove ${cell.name}`}
                        >
                          &times;
                        </button>
                      ) : null}
                      <OccupiedSeatBlock cell={cell} cardSize={cardSize} />
                    </>
                  ) : (
                    <button
                      type="button"
                      className="bb-seat-add"
                      disabled={!onEmptySeatClick}
                      onClick={() => onEmptySeatClick?.(si)}
                    >
                      <span className="bb-seat-add-plus">+</span>
                      <span className="bb-seat-add-lbl">Add</span>
                    </button>
                  )}
                </div>
              );
            })}
      </div>
    </div>
  );
}

export type EditorPayload = {
  seats: BadBeatSeatRow[];
  board: [string, string, string, string, string];
};

export function emptySeats(): SeatCell[] {
  return Array.from({ length: 10 }, () => null);
}

export function usedForPicker(
  seats: SeatCell[],
  board: [string, string, string, string, string],
  target: PickerTarget,
  pending: null | { seat: number; hole: [string, string] } = null
): Set<string> {
  return usedSetForPicker(seats, board, target, pending);
}
