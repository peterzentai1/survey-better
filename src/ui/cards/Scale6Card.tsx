// scale6: six segment buttons (radio group). Tap/click, scrubbing with any pointer, or the keyboard.
//  - tap/click or digits 1-6: select and move on after 350 ms
//  - arrow keys: move the selection without moving on; Enter confirms
import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { REACTION_CARD, temperatureArm, type InputMethod } from "../../engine/temperature.ts";
import { scaleOf, type Card } from "../../engine/schema.ts";
import { CardShell, KeyHint } from "../CardShell.tsx";
import { useCardApi, useKeyHandlers } from "../session.tsx";

const N = 6;

export function Scale6Card({ card }: { card: Extract<Card, { type: "scale6" }> }) {
  const api = useCardApi(card);
  const { ctx, state } = api.store.getState();
  const input = ctx.settings.display.scaleInput;
  const experimental = input === "ab_test" && card.id === REACTION_CARD;
  const dragPad = input === "drag_reveal" || (experimental && temperatureArm(state.sessionId) === "drag");
  const trackPointer = !experimental || dragPad;
  const scale = scaleOf(card, api.store.getState().ctx.bank);
  const stored = api.item?.status === "answered" && typeof api.item.value === "number" ? api.item.value - 1 : null;
  // `draft` is a selection that has not been confirmed yet (arrow keys, press-and-slide preview).
  const [draft, setDraft] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? draft ?? stored;
  const bar = useRef<HTMLDivElement>(null);
  const segs = useRef<(HTMLButtonElement | null)[]>([]);
  const press = useRef<{ id: number; last: number; start: number; x: number; y: number; dragged: boolean } | null>(null);
  const blockClick = useRef(false);

  const select = (i: number, input: InputMethod = "key") => {
    setDraft(null);
    api.commit(i + 1, input);
    api.autoAdvance();
  };
  const move = (i: number) => {
    const j = Math.max(0, Math.min(N - 1, i));
    setDraft(j);
    segs.current[j]?.focus();
  };
  const confirm = () => {
    if (shown !== null) select(shown);
  };
  useKeyHandlers({
    digit: (n) => n >= 1 && n <= N && select(n - 1),
    confirm,
    skip: card.skip ? api.skip : undefined,
  });

  /** Segment under the pointer: by geometry when the layout is known, else by event target. */
  const indexAt = (e: ReactPointerEvent): number | null => {
    const rect = bar.current?.getBoundingClientRect();
    if (rect && rect.width > 0) {
      const i = Math.floor(((e.clientX - rect.left) / rect.width) * N);
      return Math.max(0, Math.min(N - 1, i));
    }
    const el = (e.target as Element).closest?.("[data-idx]");
    return el ? Number(el.getAttribute("data-idx")) : null;
  };
  const outside = (e: ReactPointerEvent) => {
    const rect = bar.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return false;
    const slack = 24;
    return e.clientX < rect.left - slack || e.clientX > rect.right + slack || e.clientY < rect.top - slack || e.clientY > rect.bottom + slack;
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!trackPointer || press.current || !e.isPrimary || e.button !== 0) return;
    const i = indexAt(e);
    if (i === null) return;
    press.current = { id: e.pointerId, last: i, start: i, x: e.clientX, y: e.clientY, dragged: false };
    if (!dragPad) setPreview(i);
    try {
      bar.current?.setPointerCapture?.(e.pointerId);
    } catch {
      /* optional */
    }
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const i = indexAt(e);
    const dx = Math.abs(e.clientX - p.x);
    const dy = Math.abs(e.clientY - p.y);
    if (dragPad && !p.dragged && dy >= 6 && dy > dx) {
      press.current = null;
      setPreview(null);
      return;
    }
    if (dx >= 6 || (i !== null && i !== p.start)) p.dragged = true;
    if (i !== null && p.dragged) {
      p.last = i;
      setPreview(i);
    }
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    blockClick.current = true;
    window.setTimeout(() => (blockClick.current = false), 100);
    const i = indexAt(e) ?? p.last;
    setPreview(null);
    if (!outside(e)) {
      if (p.dragged) api.store.getState().recordInput("drag");
      select(i, p.dragged ? "drag" : "tap");
    }
  };
  const onPointerCancel = (e: ReactPointerEvent) => {
    if (press.current?.id !== e.pointerId) return;
    press.current = null;
    setPreview(null);
  };

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        move(i + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        move(i - 1);
        break;
      case "Home":
        e.preventDefault();
        move(0);
        break;
      case "End":
        e.preventDefault();
        move(N - 1);
        break;
      case "Enter":
        e.preventDefault();
        select(draft ?? i);
        break;
      case " ":
        e.preventDefault();
        setDraft(i); // Space marks the segment; Enter confirms
        break;
    }
  };

  const tabStop = shown ?? 0;
  return (
    <CardShell api={api}>
      <div
        ref={bar}
        role="radiogroup"
        aria-label={api.text}
        className={dragPad ? "scale-control" : "relative flex gap-1.5 select-none"}
        style={{ touchAction: experimental || dragPad ? "pan-y pinch-zoom" : "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
      >
        {dragPad && (
          <div className="scale-pad" aria-hidden="true">
            {preview === null ? (
              <span className="scale-invite"><span className="scale-grip">↔</span>Húzza oldalra vagy koppintson</span>
            ) : (
              <div className="scale-rail">
                <span className="scale-bubble" style={{ left: `${preview / (N - 1) * 100}%` }}>
                  <span key={preview} className="scale-digit">{preview + 1}</span>
                </span>
              </div>
            )}
          </div>
        )}
        <div className={dragPad ? "absolute inset-0 grid grid-cols-6" : "contents"}>
          {Array.from({ length: N }, (_, i) => (
            <button
              key={i}
              ref={(el) => {
                segs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={shown === i}
              aria-label={`${i + 1} – ${scale.labels[i]}`}
              data-idx={i}
              tabIndex={tabStop === i ? 0 : -1}
              className={dragPad ? "scale-choice" : "opt !min-h-14 flex-1 !justify-center !px-0 text-lg"}
              onKeyDown={(e) => onKeyDown(e, i)}
              onClick={(e) => {
                if (blockClick.current || (dragPad && e.detail > 0)) return;
                if (e.detail === 0) setDraft(i); // keyboard-originated click: mark only
                else select(i, "tap");
              }}
            >
              {dragPad ? null : i + 1}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between gap-4 text-sm text-muted" aria-hidden="true">
        <span>{scale.left}</span>
        <span className="text-right">{scale.right}</span>
      </div>
      <p role="status" className="mt-3 min-h-7 text-center text-lg font-semibold">
        {shown !== null ? scale.labels[shown] : ""}
      </p>
      {draft !== null && (
        <button type="button" className="btn btn-primary mt-3 w-full" onClick={confirm}>
          Tovább
          <KeyHint>Enter</KeyHint>
        </button>
      )}
      <p className="mt-1 hidden text-center text-sm text-muted [@media(hover:hover)_and_(pointer:fine)]:block">
        Számbillentyű 1–6: választ és továbblép <KeyHint>1–6</KeyHint> · nyilak: mozgatás, Enter: megerősítés
      </p>
    </CardShell>
  );
}
