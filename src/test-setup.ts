// Test environment setup: jsdom gaps and cleanup.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Recent Node versions define a global `localStorage` that shadows jsdom's and is unusable without a
// flag. Install a small in-memory Storage so tests behave like a browser.
class MemoryStorage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}
const memory = new MemoryStorage();
Object.defineProperty(globalThis, "Storage", { value: MemoryStorage, configurable: true, writable: true });
Object.defineProperty(globalThis, "localStorage", { value: memory, configurable: true, writable: true });
Object.defineProperty(window, "localStorage", { value: memory, configurable: true, writable: true });

afterEach(() => {
  cleanup();
  memory.clear();
});

// jsdom may lack PointerEvent; fall back to a MouseEvent subclass that keeps pointer fields.
if (typeof (window as unknown as { PointerEvent?: unknown }).PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "mouse";
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPolyfill;
  (globalThis as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPolyfill;
}

// jsdom does not implement scrolling.
window.scrollTo = () => {};

// matchMedia stub: no reduced motion, no fine pointer by default (tests can override).
if (typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
