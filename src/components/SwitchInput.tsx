"use client";

import type { InputHTMLAttributes } from "react";

type SwitchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role">;

// The HTML `switch` attribute isn't in React's types yet; pass it through as-is.
const switchAttr = { switch: "" } as InputHTMLAttributes<HTMLInputElement>;

/**
 * Native <input type="checkbox" switch> (Safari 17.4+).
 *
 * Elsewhere we apply the input-switch-polyfill styles (imported in
 * globals.css, scoped to `input.switch`). We don't load the polyfill's JS:
 * it reads its CSS via `import.meta.resolve`, which Turbopack doesn't
 * support, so it throws before upgrading anything. The upgrade it performs
 * — add the `switch` class and copy accent-color — is done here instead.
 */
export function SwitchInput(props: SwitchInputProps) {
  return (
    <input
      {...props}
      {...switchAttr}
      type="checkbox"
      role="switch"
      ref={(el) => {
        if (!el || "switch" in HTMLInputElement.prototype) return;
        el.classList.add("switch");
        const { accentColor } = getComputedStyle(el);
        if (accentColor && accentColor !== "auto") {
          el.style.setProperty("--switch-accent", accentColor);
        }
      }}
    />
  );
}
