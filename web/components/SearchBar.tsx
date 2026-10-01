"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 250;

/**
 * Search box. Typing is instant locally; the committed value (which drives the URL and the
 * results) follows after a short pause. Outside changes to `value` (back/forward, a shared
 * link, Clear) replace the text.
 */
export function SearchBar({ value, onCommit }: { value: string; onCommit: (q: string) => void }) {
  const [text, setText] = useState(value);
  const committed = useRef(value);

  // `value` differs from what we last committed only when something else changed it.
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    if (text === committed.current) return;
    const t = setTimeout(() => {
      committed.current = text;
      onCommit(text);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text, onCommit]);

  const clear = () => {
    committed.current = "";
    setText("");
    onCommit("");
  };

  return (
    <div role="search" className="relative">
      <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && text && clear()}
        aria-label="Search cafes by name, street or neighborhood"
        placeholder="Search by name, street or neighborhood"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className={
          "w-full rounded-lg border border-line bg-surface py-2.5 pr-10 pl-9 text-sm text-foreground placeholder:text-dim " +
          "focus-visible:border-accent focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
        }
      />
      {text && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}
