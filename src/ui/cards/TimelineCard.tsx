// timeline: 24 one-hour cells as 4 rows x 6 columns. Tap/click toggles, dragging paints, arrows + Space on the keyboard.
import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { paintHours } from "../../engine/inputs.ts";
import type { Card } from "../../engine/schema.ts";
import { CardShell, KeyHint } from "../CardShell.tsx";
import { useCardApi, useKeyHandlers } from "../session.tsx";

const ROWS = ["Éjszaka, hajnal", "Délelőtt", "Délután", "Este"];

export function TimelineCard({ card }: { card: Extract<Card, { type: "timeline" }> }) {
  const api = useCardApi(card);
  const stored = Array.isArray(api.item?.value) ? (api.item.value as number[]) : [];
  const [selected, setSelected] = useState<number[]>(stored);
  const selRef = useRef(selected);
  const [note, setNote] = useState("");
  const [focusHour, setFocusHour] = useState(stored[0] ?? 0);
  const grid = useRef<HTMLDivElement>(null);
  const paint = useRef<{ id: number; mode: "add" | "remove"; last: number } | null>(null);
  const blockClick = useRef(false);

  const apply = (hours: number[], mode: "add" | "remove") => {
    const { next, blocked } = paintHours(selRef.current, hours, mode, card.max);
    selRef.current = next;
    setSelected(next);
    setNote(blocked ? `Legfeljebb ${card.max} óra jelölhető. Vegyen le egyet, ha másikat jelölne.` : "");
  };
  const toggle = (h: number) => apply([h], selRef.current.includes(h) ? "remove" : "add");
  const proceed = () => {
    if (selRef.current.length === 0) return;
    api.commit(selRef.current);
    api.next();
  };
  useKeyHandlers({ confirm: proceed, skip: card.skip ? api.skip : undefined });

  const focusCell = (h: number) => {
    const c = Math.max(0, Math.min(23, h));
    setFocusHour(c);
    grid.current?.querySelector<HTMLElement>(`[data-hour="${c}"]`)?.focus();
  };

  /** Cell under the pointer: by geometry when layout exists, else by event target (jsdom). */
  const hourAt = (e: ReactPointerEvent): number | null => {
    const cells = grid.current?.querySelectorAll<HTMLElement>("[data-hour]") ?? [];
    for (const el of cells) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        return Number(el.dataset.hour);
      }
    }
    const t = (e.target as Element).closest?.("[data-hour]");
    return t ? Number((t as HTMLElement).dataset.hour) : null;
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const h = hourAt(e);
    if (h === null) return;
    const mode = selRef.current.includes(h) ? "remove" : "add"; // the first cell decides add or remove
    paint.current = { id: e.pointerId, mode, last: h };
    blockClick.current = true;
    setFocusHour(h);
    apply([h], mode);
    try {
      grid.current?.setPointerCapture?.(e.pointerId);
    } catch {
      /* optional */
    }
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const p = paint.current;
    if (!p || p.id !== e.pointerId) return;
    const h = hourAt(e);
    if (h === null || h === p.last) return;
    const [a, b] = h > p.last ? [p.last + 1, h] : [h, p.last - 1];
    apply(Array.from({ length: b - a + 1 }, (_, k) => a + k), p.mode); // fill cells a fast drag skipped
    p.last = h;
  };
  const endPaint = (e: ReactPointerEvent) => {
    if (paint.current?.id !== e.pointerId) return;
    paint.current = null;
    window.setTimeout(() => (blockClick.current = false), 100);
  };

  const onKeyDown = (e: KeyboardEvent, h: number) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const moves: Record<string, number> = { ArrowLeft: h - 1, ArrowRight: h + 1, ArrowUp: h - 6, ArrowDown: h + 6, Home: 0, End: 23 };
    if (e.key in moves) {
      e.preventDefault();
      focusCell(moves[e.key]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      proceed();
    }
  };

  return (
    <CardShell api={api}>
      <div
        ref={grid}
        className="flex select-none flex-col gap-3"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPaint}
        onPointerCancel={endPaint}
      >
        {ROWS.map((label, r) => (
          <div key={label} role="group" aria-label={`${label} (${r * 6}–${r * 6 + 5} óra)`}>
            <p className="mb-1 text-sm text-muted">
              {label} <span aria-hidden="true">· {r * 6}–{r * 6 + 5} h</span>
            </p>
            <div className="grid grid-cols-6 gap-1.5" style={{ touchAction: "none" }}>
              {Array.from({ length: 6 }, (_, c) => {
                const h = r * 6 + c;
                const on = selected.includes(h);
                return (
                  <button
                    key={h}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`${h}:00–${h + 1}:00`}
                    data-hour={h}
                    tabIndex={focusHour === h ? 0 : -1}
                    className="opt !min-h-12 !justify-center !px-0"
                    onKeyDown={(e) => onKeyDown(e, h)}
                    onClick={() => {
                      if (blockClick.current) return;
                      toggle(h); // keyboard (Space) or assistive technology
                    }}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p role="status" className="mt-2 min-h-5 text-sm text-danger">
        {note}
      </p>
      <p className="text-sm text-muted">
        Koppintson az órákra, vagy húzza végig az ujját rajtuk{card.max ? ` (legfeljebb ${card.max} óra)` : ""}.
        <span className="hidden [@media(hover:hover)_and_(pointer:fine)]:inline"> Nyilak: mozgás, szóköz: jelölés.</span>
      </p>
      <button type="button" className="btn btn-primary mt-3 w-full" disabled={selected.length === 0} onClick={proceed}>
        Tovább
        <KeyHint>Enter</KeyHint>
      </button>
    </CardShell>
  );
}
