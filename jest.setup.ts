import "@testing-library/jest-dom";

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
