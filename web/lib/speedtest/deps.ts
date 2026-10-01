import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { CAFES_TAG } from "@/lib/cafes";
import { createDb, type Db } from "./db";

export interface Deps {
  db: Db;
  fetch: typeof fetch;
  now: () => number;
  nonce: () => string;
  dev: boolean;
  env: { turnstileSecret: string; ipinfoToken: string; tokenSecret: string; ipSalt: string };
  /** Called after an accepted result so the card badge refreshes. */
  onAccepted: () => void;
}

/** Real dependencies from the environment, or null (route answers 500) if anything is missing. */
export function getDeps(): Deps | null {
  const e = process.env;
  const url = e.NEXT_PUBLIC_SUPABASE_URL;
  const key = e.SUPABASE_SERVICE_ROLE_KEY;
  const { TURNSTILE_SECRET_KEY: turnstileSecret, IPINFO_TOKEN: ipinfoToken, SPEEDTEST_TOKEN_SECRET: tokenSecret, IP_HASH_SALT: ipSalt } = e;
  if (!url || !key || !turnstileSecret || !ipinfoToken || !tokenSecret || !ipSalt) return null;
  return {
    db: createDb(url, key),
    fetch,
    now: Date.now,
    nonce: randomUUID,
    dev: e.NODE_ENV === "development",
    env: { turnstileSecret, ipinfoToken, tokenSecret, ipSalt },
    onAccepted: () => {
      revalidateTag(CAFES_TAG, { expire: 0 });
      revalidatePath("/");
    },
  };
}
