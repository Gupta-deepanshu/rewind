import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "node:util";

// Every browser and Node has these, but jsdom doesn't (the clerk's URL filters use them).
globalThis.TextEncoder ??= TextEncoder as typeof globalThis.TextEncoder;
globalThis.TextDecoder ??= TextDecoder as typeof globalThis.TextDecoder;

// Browser APIs jsdom doesn't have, used by the tab indicator and reduced-motion checks.
if (typeof window !== "undefined") {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;

  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  if (!("fonts" in document)) {
    Object.defineProperty(document, "fonts", { value: { ready: Promise.resolve() } });
  }
}
