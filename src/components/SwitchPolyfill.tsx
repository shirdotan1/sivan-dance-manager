"use client";

import { useEffect } from "react";

/**
 * Loads the <input type="checkbox" switch> polyfill only in browsers that
 * lack native support (native today: Safari 17.4+). The polyfill's CSS is
 * imported globally in globals.css and only targets inputs it upgrades.
 */
export function SwitchPolyfill() {
  useEffect(() => {
    if (!("switch" in HTMLInputElement.prototype)) {
      import("input-switch-polyfill").catch(() => {
        // Non-critical: without it, switches render as regular checkboxes.
      });
    }
  }, []);
  return null;
}
