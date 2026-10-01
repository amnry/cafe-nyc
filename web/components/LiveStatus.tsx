"use client";

import { formatNyClock } from "@/lib/hours";
import { useNow } from "@/lib/useNow";
import { MONO_LABEL } from "./bits";

/** "NEW YORK · 11:42 PM". The clock only exists client-side. */
export function LiveStatus() {
  const now = useNow();
  return (
    <p className={`${MONO_LABEL} min-h-4 text-accent`}>
      New York
      {now && <> · {formatNyClock(now)}</>}
    </p>
  );
}
