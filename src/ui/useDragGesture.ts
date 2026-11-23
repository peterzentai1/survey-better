// Horizontal drag gesture for yes/no cards. Touch and pen only; a mouse drag never answers.
// The drag encodes only yes (right) or no (left): no strength, no duration, no repetition is read from it.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
}

export const DRAG_THRESHOLD = 0.3; // fraction of the card width
const FLICK_SPEED = 0.5; // px per ms
const FLICK_MIN = 40; // px
const START_SLOP = 10; // px before a movement counts as a drag
const LEAVE_MS = 180;

export function useDragGesture(opts: { onCommit: (dir: 1 | -1) => void; onDrag?: () => void }) {
  const elRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const moved = useRef(false);
  const blockClick = useRef(false);
  const timers = useRef<number[]>([]);
  const [dx, setDx] = useState(0);
  const [phase, setPhase] = useState<"idle" | "drag" | "leaving">("idle");
  const reduced = prefersReducedMotion();
  const latest = useRef(opts);
  latest.current = opts;

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const width = () => elRef.current?.getBoundingClientRect().width || 320; // jsdom has no layout
  const reset = useCallback(() => {
    start.current = null;
    setDx(0);
    setPhase("idle");
  }, []);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (phase === "leaving" || !e.isPrimary) return;
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
    moved.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    const ddx = e.clientX - s.x;
    const ddy = e.clientY - s.y;
    if (!moved.current && Math.abs(ddx) > START_SLOP && Math.abs(ddx) > Math.abs(ddy)) {
      moved.current = true;
      try {
        elRef.current?.setPointerCapture?.(e.pointerId);
      } catch {
        /* capture is optional */
      }
    }
    if (moved.current) {
      setDx(ddx);
      setPhase("drag");
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    start.current = null;
    if (!moved.current) return;
    // The click that follows a drag must not press a button under the finger.
    blockClick.current = true;
    timers.current.push(window.setTimeout(() => (blockClick.current = false), 100));
    const ddx = e.clientX - s.x;
    const ddy = e.clientY - s.y;
    const fast = Math.abs(ddx) / Math.max(1, e.timeStamp - s.t) > FLICK_SPEED && Math.abs(ddx) > FLICK_MIN;
    const far = Math.abs(ddx) >= width() * DRAG_THRESHOLD;
    if ((far || fast) && Math.abs(ddx) > Math.abs(ddy)) {
      const dir = ddx > 0 ? 1 : -1;
      latest.current.onDrag?.();
      setPhase("leaving");
      setDx(dir * width() * 1.2);
      timers.current.push(window.setTimeout(() => latest.current.onCommit(dir), reduced ? 0 : LEAVE_MS));
    } else {
      reset(); // snap back
    }
  };

  const onPointerCancel = () => reset();
  const onClickCapture = (e: React.MouseEvent) => {
    if (blockClick.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const w = width();
  const style: CSSProperties = {
    touchAction: "pan-y", // vertical scrolling stays native
    position: "relative",
    ...(reduced
      ? {}
      : {
          transform: dx ? `translateX(${dx}px) rotate(${(dx / w) * 8}deg)` : undefined,
          transition: phase === "drag" ? "none" : `transform ${LEAVE_MS}ms ease, opacity ${LEAVE_MS}ms ease`,
          opacity: phase === "leaving" ? 0 : 1,
        }),
  };

  return {
    ref: elRef,
    dx: phase === "idle" ? 0 : dx,
    /** 0..1: how close the drag is to the answer threshold (drives the label opacity). */
    progress: Math.min(1, Math.abs(dx) / (w * DRAG_THRESHOLD)),
    reset,
    props: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture, style },
  };
}
