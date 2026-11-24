// Browser history <-> card stack. One owner for both directions:
//  - every card shown pushes one history entry ({ kd: depth });
//  - popstate (browser Back, trackpad two-finger back gesture) steps back one card instead of leaving the page;
//  - when the app moves back itself (Vissza button, Backspace, undo) it also moves the browser back and swallows the popstate.
import { useEffect } from "react";
import type { SessionStore } from "../state/store.ts";

export function useBrowserHistory(store: SessionStore) {
  useEffect(() => {
    const want = () => store.getState().state.history.length;
    // Depth of the browser entry we are on; resumes correctly if the effect runs twice (StrictMode).
    let depth = (history.state as { kd?: number } | null)?.kd ?? 0;
    if (depth === 0) {
      history.replaceState({ kd: 1 }, "");
      depth = 1;
    }
    let busy = false;
    let pendingBack: number | undefined;

    const sync = () => {
      if (busy || pendingBack !== undefined) return;
      const target = want();
      if (target > depth) {
        for (let d = depth + 1; d <= target; d++) history.pushState({ kd: d }, "");
        depth = target;
      } else if (target < depth) {
        // history.go() is asynchronous. Re-read the target once the browser arrives.
        pendingBack = window.setTimeout(() => {
          pendingBack = undefined;
          // Some webviews never emit popstate. Use the current entry as the new base
          // so later navigation can resume without retrying the same traversal.
          const current = want();
          if (current < depth) {
            history.replaceState({ kd: current }, "");
            depth = current;
          }
          sync();
        }, 500);
        history.go(target - depth);
      }
    };
    sync();
    const unsubscribe = store.subscribe(sync);

    const onPop = (e: PopStateEvent) => {
      depth = (e.state as { kd?: number } | null)?.kd ?? 1;
      if (pendingBack !== undefined) {
        window.clearTimeout(pendingBack);
        pendingBack = undefined;
        sync();
        return;
      }
      if (store.getState().state.completed) return;
      const cards = want();
      if (depth < cards) {
        busy = true; // the browser already moved; do not push or go() while stepping the app back
        for (let i = 0; i < cards - depth; i++) store.getState().back();
        busy = false;
      }
      sync(); // forward navigation (kd > cards): bring the browser back to the current card
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.clearTimeout(pendingBack);
      window.removeEventListener("popstate", onPop);
      unsubscribe();
    };
  }, [store]);
}
