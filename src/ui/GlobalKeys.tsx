// Global keyboard shortcuts. They only accelerate: every action also exists as a button.
//   I / ArrowRight = igen, N / ArrowLeft = nem (yesno cards), 1-9 (scale and count cards), K or 0 = skip,
//   Enter = continue/confirm, Backspace = previous card.
import { useContext, useEffect } from "react";
import { KeyRegistry, useSessionStore } from "./session.tsx";

const TYPING = 'textarea, select, [contenteditable="true"], input:not([type="checkbox"]):not([type="radio"])';
const NATIVE_ENTER = 'button, a[href], summary, select, textarea, [role="checkbox"], [role="radio"]';

export function GlobalKeys() {
  const store = useSessionStore();
  const registry = useContext(KeyRegistry);

  useEffect(() => {
    const onTap = () => store.getState().recordInput("tap");
    const onKey = (e: KeyboardEvent) => {
      store.getState().recordInput("key");
      // Ignore browser shortcuts, auto-repeat (a held key is one gesture) and IME composition.
      if (e.defaultPrevented || e.repeat || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(TYPING)) return;
      const h = registry?.current ?? {};
      const act = (fn: (() => void) | undefined) => {
        if (!fn) return;
        e.preventDefault();
        fn();
      };
      switch (e.key) {
        case "Backspace":
          if (store.getState().state.history.length > 1) act(() => store.getState().back());
          break;
        case "Enter":
          // Focused buttons and tiles handle Enter themselves.
          if (!target?.closest(NATIVE_ENTER)) act(h.confirm);
          break;
        case "i":
        case "I":
          act(h.yes);
          break;
        case "ArrowRight":
          act(h.arrowRight ?? h.yes);
          break;
        case "n":
        case "N":
          act(h.no);
          break;
        case "ArrowLeft":
          act(h.arrowLeft ?? h.no);
          break;
        case "k":
        case "K":
        case "0":
          act(h.skip);
          break;
        default:
          if (/^[1-9]$/.test(e.key) && h.digit) act(() => h.digit?.(Number(e.key)));
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onTap, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onTap, true);
    };
  }, [store, registry]);

  return null;
}
