// yesno: two big buttons; on touch/pen a horizontal drag also answers (right = yes, left = no).
import { useState } from "react";
import type { Card } from "../../engine/schema.ts";
import { CardShell, KeyHint } from "../CardShell.tsx";
import { useCardApi, useKeyHandlers } from "../session.tsx";
import { useDragGesture } from "../useDragGesture.ts";

const HINT_KEY = "kartya-kerdoiv:drag-hint-seen";
let hintSeenInMemory = false;

function isCoarsePointer(): boolean {
  try {
    return window.matchMedia?.("(pointer: coarse)").matches ?? false;
  } catch {
    return false;
  }
}

function readHintSeen(): boolean {
  if (hintSeenInMemory) return true;
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Forget the one-time hint (used by tests). */
export function resetDragHint() {
  hintSeenInMemory = false;
}

export function YesNoCard({ card }: { card: Extract<Card, { type: "yesno" }> }) {
  const api = useCardApi(card);
  const yesLabel = card.yesLabel ?? "Igen";
  const noLabel = card.noLabel ?? "Nem";
  const selected = api.item?.status === "answered" ? api.item.value : undefined;
  const [showHint, setShowHint] = useState(() => isCoarsePointer() && !readHintSeen());

  const answerButton = (value: "igen" | "nem") => {
    api.commit(value);
    api.autoAdvance();
  };
  const gesture = useDragGesture({
    onDrag: () => api.store.getState().recordInput("drag"),
    onCommit: (dir) => {
      const value = dir > 0 ? "igen" : "nem";
      if (api.inJump) {
        api.commit(value);
        gesture.reset();
      } else {
        api.store.getState().answerAndAdvanceWithUndo(card.id, value, `Válasz rögzítve: ${dir > 0 ? yesLabel : noLabel}`);
      }
    },
  });
  useKeyHandlers({ yes: () => answerButton("igen"), no: () => answerButton("nem"), skip: card.skip ? api.skip : undefined });

  const dismissHint = () => {
    hintSeenInMemory = true;
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowHint(false);
  };

  return (
    <div ref={gesture.ref} {...gesture.props} data-testid="yesno-drag">
      {gesture.dx !== 0 && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute top-4 z-10 rounded-lg border-4 bg-surface px-3 py-1 text-2xl font-bold ${
            gesture.dx > 0 ? "left-4 border-yes text-yes" : "right-4 border-no text-no"
          }`}
          style={{ opacity: gesture.progress }}
          data-testid="drag-label"
        >
          {gesture.dx > 0 ? yesLabel : noLabel}
        </div>
      )}
      <CardShell api={api}>
        {showHint && (
          <div role="note" className="mb-3 rounded-lg bg-primary-soft p-3 text-sm">
            Tipp: a kártyát ujjával jobbra húzva „{yesLabel}”, balra húzva „{noLabel}” választ adhat. A gombok is használhatók.
            <button type="button" className="btn btn-quiet ml-2 !min-h-12" onClick={dismissHint}>
              Értem
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="opt !min-h-16 !justify-center text-lg" aria-pressed={selected === "igen"} onClick={() => answerButton("igen")}>
            {yesLabel}
            <KeyHint>I / →</KeyHint>
          </button>
          <button type="button" className="opt !min-h-16 !justify-center text-lg" aria-pressed={selected === "nem"} onClick={() => answerButton("nem")}>
            {noLabel}
            <KeyHint>N / ←</KeyHint>
          </button>
        </div>
      </CardShell>
    </div>
  );
}
