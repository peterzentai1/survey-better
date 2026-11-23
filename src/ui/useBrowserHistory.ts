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
    let swallow = 0; // popstate events caused by our own history.go()
    let busy = false;

    const sync = () => {
      if (busy) return;
      const target = want();
      if (target > depth) {
        for (let d = depth + 1; d <= target; d++) history.pushState({ kd: d }, "");
        depth = target;
      } else if (target < depth) {
        swallow++;
        history.go(target - depth);
        depth = target;
      }
    };
    sync();
    const unsubscribe = store.subscribe(sync);

    const onPop = (e: PopStateEvent) => {
      if (swallow > 0) {
        swallow--;
        return;
      }
      if (store.getState().state.completed) return;
      const kd = (e.state as { kd?: number } | null)?.kd ?? 1;
      const cards = want();
      depth = kd;
      if (kd < cards) {
        busy = true; // the browser already moved; do not push or go() while stepping the app back
        for (let i = 0; i < cards - kd; i++) store.getState().back();
        busy = false;
      }
      sync(); // forward navigation (kd > cards): bring the browser back to the current card
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      unsubscribe();
    };
  }, [store]);
}
