"use client";

import { useEffect } from "react";

/** Opens the FAQ entry (a closed <details>) that the URL hash points at, on load and on in-page jumps. */
export function OpenFaqOnHash() {
  useEffect(() => {
    const open = () => {
      const el = document.getElementById(window.location.hash.slice(1));
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        el.scrollIntoView({ block: "start" });
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
