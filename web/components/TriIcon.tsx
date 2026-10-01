import { Check, CircleHelp, Dog, Toilet, X } from "lucide-react";
import type { TriState } from "@/lib/types";

const ICONS = { restroom: Toilet, dogs: Dog } as const;
const LABELS = { restroom: "Restroom", dogs: "Dogs welcome" } as const;

/**
 * Tri-state indicator. Yes / no / unknown differ by shape, not just colour, and
 * unknown is deliberately NOT styled like "no".
 */
export function TriIcon({ kind, value }: { kind: keyof typeof ICONS; value: TriState }) {
  const Icon = ICONS[kind];
  const text = value === true ? "yes" : value === false ? "no" : "unknown";
  const Badge = value === true ? Check : value === false ? X : CircleHelp;
  const tone =
    value === true
      ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300"
      : value === false
        ? "border-zinc-400 text-zinc-500 line-through decoration-2 dark:border-zinc-500 dark:text-zinc-400"
        : "border-dashed border-zinc-300 text-zinc-400 dark:border-zinc-600 dark:text-zinc-500";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${tone}`}
      title={`${LABELS[kind]}: ${text}`}
      aria-label={`${LABELS[kind]}: ${text}`}
      role="img"
    >
      <Icon size={14} aria-hidden />
      <Badge size={12} aria-hidden />
    </span>
  );
}
