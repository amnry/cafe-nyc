"use client";

import { useEffect, useRef, useState } from "react";
import { MONO_LABEL } from "./bits";

/**
 * "Source" label that reveals where the data comes from. Hover/focus shows it on desktop;
 * tap toggles it on touch (WebKit doesn't focus buttons on tap, so CSS alone isn't enough).
 * Outside tap or Esc closes it.
 */
export function SourceNote() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="group relative inline-flex">
      <button
        type="button"
        aria-describedby="data-source"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${MONO_LABEL} cursor-help text-muted underline decoration-dotted underline-offset-4 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none`}
      >
        Source
      </button>
      <span
        id="data-source"
        role="tooltip"
        className={
          "pointer-events-none absolute bottom-full left-1/2 mb-2 w-max max-w-[15rem] -translate-x-1/2 " +
          "bg-foreground px-3 py-2 text-xs leading-snug text-surface shadow-lg " +
          "transition duration-150 motion-reduce:transition-none " +
          (open
            ? "translate-y-0 opacity-100"
            : "translate-y-1 opacity-0 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100")
        }
      >
        Places, hours and summaries from <span className="text-accent">Google Maps</span>, refreshed every two weeks.
      </span>
    </span>
  );
}
