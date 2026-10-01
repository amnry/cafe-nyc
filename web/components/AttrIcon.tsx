"use client";

import { Dog, Toilet, Trees, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { triWord } from "@/lib/drawer";
import type { TriState } from "@/lib/types";

export type AttrKind = "restroom" | "dogs" | "outdoor";

const ATTRS: Record<AttrKind, { Icon: LucideIcon; label: string }> = {
  restroom: { Icon: Toilet, label: "Restroom" },
  dogs: { Icon: Dog, label: "Dogs" },
  outdoor: { Icon: Trees, label: "Outdoor seating" },
};

/** Bare glyph, no state styling. Used in the filter chips next to the text label. */
export function AttrGlyph({ kind, size = 14 }: { kind: AttrKind; size?: number }) {
  const { Icon } = ATTRS[kind];
  return <Icon size={size} strokeWidth={1.75} aria-hidden />;
}

/**
 * Card attribute icon. true = ink + amber glow, false = dimmed + diagonal slash, null = not rendered
 * (unknown is never drawn as "no"). Hover or keyboard focus shows a tooltip; a tap toggles it on touch devices
 * and any outside tap closes it. A mouse click never pins it open.
 */
export function AttrIcon({ kind, value }: { kind: AttrKind; value: TriState }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const pointer = useRef("mouse");

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  if (value === null) return null;
  const { Icon, label } = ATTRS[kind];
  const text = `${label}: ${triWord(value)}`;
  return (
    <span ref={ref} className="group relative z-10 inline-flex">
      <button
        type="button"
        aria-label={text}
        onPointerDown={(e) => (pointer.current = e.pointerType)}
        // Mouse already gets the tooltip from hover; toggling it too would leave it stuck open after a click.
        onClick={() => pointer.current !== "mouse" && setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className={
          "relative inline-flex p-1 focus-visible:outline-2 focus-visible:outline-foreground " +
          (value ? "text-foreground" : "text-dim opacity-70")
        }
      >
        <Icon
          size={16}
          strokeWidth={1.75}
          aria-hidden
          style={value ? { filter: "drop-shadow(0 0 3px var(--accent)) drop-shadow(0 0 1px var(--accent))" } : undefined}
        />
        {!value && (
          <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute inset-1 size-4">
            <line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>
      <span
        role="tooltip"
        className={
          "pointer-events-none absolute right-0 bottom-full z-20 mb-1 bg-foreground px-1.5 py-0.5 " +
          "font-mono text-[10px] whitespace-nowrap text-surface group-hover:block group-has-[:focus-visible]:block " +
          (open ? "block" : "hidden")
        }
      >
        {text}
      </span>
    </span>
  );
}
