"use client";

import { useEffect } from "react";

/**
 * When the page is opened at #<targetId> (e.g. "עריכת משתתפות" → /edit#participants),
 * move keyboard and screen-reader focus to that section, not just the scroll position.
 * The target needs tabIndex={-1}.
 */
export function FocusOnHash({ targetId }: { targetId: string }) {
  useEffect(() => {
    if (window.location.hash !== `#${targetId}`) return;
    const el = document.getElementById(targetId);
    el?.scrollIntoView({ block: "start" });
    el?.focus({ preventScroll: true });
  }, [targetId]);
  return null;
}
