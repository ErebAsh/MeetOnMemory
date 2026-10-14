import "@testing-library/jest-dom";
import "./i18n.js";
import { vi } from "vitest";

// jsdom does not implement IntersectionObserver. Provide a minimal browser-like
// constructor so components that call `new IntersectionObserver(...)` work in tests.
if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor(callback, options = {}) {
      this.callback = callback;
      this.options = options;
      this._observed = new Set();
    }

    observe(target) {
      if (!target) return;
      this._observed.add(target);
      this.callback(
        [
          {
            isIntersecting: true,
            target,
            intersectionRatio: 1,
            time: Date.now(),
            boundingClientRect: {},
            intersectionRect: {},
            rootBounds: null,
          },
        ],
        this,
      );
    }

    unobserve(target) {
      this._observed.delete(target);
    }

    disconnect() {
      this._observed.clear();
    }

    takeRecords() {
      return [];
    }
  };
}

// jsdom does not implement ResizeObserver. Provide a minimal browser-like mock.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom does not implement Element.prototype.scrollIntoView. Provide a mock function.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

if (typeof window !== "undefined") {
  window.scrollTo = vi.fn();
}

vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_bW9jay1jbGVyay1rZXk");
