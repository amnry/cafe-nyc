"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { matchNeighborhoods } from "@/lib/filters";
import { MONO_LABEL } from "./bits";

/**
 * Searchable multi-select (combobox + listbox pattern). Focus stays in the input; arrow keys move the
 * active option, Enter toggles it, Escape closes. Selected neighborhoods show as removable tags.
 */
export function NeighborhoodPicker({ options, selected, onChange }: {
  options: { name: string; count: number }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const matches = useMemo(() => matchNeighborhoods(options, query), [options, query]);
  const activeIndex = Math.min(active, Math.max(matches.length - 1, 0));
  const optionId = (i: number) => `${id}-opt-${i}`;

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + matches.length) % Math.max(matches.length, 1));
    } else if (e.key === "Enter" && open && matches[activeIndex]) {
      e.preventDefault();
      toggle(matches[activeIndex].name);
    } else if (e.key === "Escape") {
      if (open || query) {
        e.stopPropagation();
        setOpen(false);
        setQuery("");
      }
    } else if (e.key === "Backspace" && !query && selected.length > 0) {
      onChange(selected.slice(0, -1));
    }
  };

  return (
    <div ref={root} className="relative">
      <div
        className="flex min-h-[34px] flex-wrap items-center gap-1 rounded-lg border border-line bg-surface px-1.5 py-0.5 focus-within:border-foreground"
        onClick={() => input.current?.focus()}
      >
        {selected.map((name) => (
          <span key={name} className="inline-flex items-center gap-1 rounded-md bg-foreground px-2 py-0.5 text-[12px] leading-5 font-medium text-surface">
            {name}
            <button
              type="button"
              aria-label={`Remove ${name}`}
              onClick={(e) => {
                e.stopPropagation();
                toggle(name);
              }}
              className="rounded-sm hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-surface"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          ref={input}
          role="combobox"
          aria-label="Neighborhood"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && matches.length > 0 ? optionId(activeIndex) : undefined}
          value={query}
          placeholder={selected.length === 0 ? "All neighborhoods" : "Add…"}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-[8ch] flex-1 bg-transparent px-1.5 py-1 text-[13px] leading-5 text-foreground placeholder:text-muted focus:outline-none"
        />
        <ChevronDown className="mr-1 size-4 shrink-0 text-muted" aria-hidden />
      </div>
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-multiselectable="true"
          aria-label="Neighborhoods"
          className="absolute left-0 z-30 mt-1 max-h-72 w-72 max-w-[calc(100vw-2rem)] overflow-auto border border-foreground bg-surface py-1 shadow-[3px_3px_0_rgba(26,18,3,.25)]"
        >
          {matches.length === 0 && <li className={`px-3 py-2 ${MONO_LABEL} text-muted`}>No neighborhoods match</li>}
          {matches.map((o, i) => {
            const on = selected.includes(o.name);
            return (
              <li
                key={o.name}
                id={optionId(i)}
                role="option"
                aria-selected={on}
                onPointerDown={(e) => e.preventDefault() /* keep focus in the input */}
                onClick={() => toggle(o.name)}
                onPointerMove={() => setActive(i)}
                className={
                  "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-foreground " +
                  (i === activeIndex ? "bg-surface-2" : "")
                }
              >
                <span className="grid size-4 shrink-0 place-items-center border border-foreground">
                  {on && <Check className="size-3" aria-hidden />}
                </span>
                <span className="flex-1">{o.name}</span>
                <span className="font-mono text-[11px] tabular-nums text-muted">{o.count}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
