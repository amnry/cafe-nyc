import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { CAFES_TAG } from "@/lib/cafes";

const digest = (s: string) => createHash("sha256").update(s).digest();

/**
 * On-demand refresh, called by the ETL after it writes to Supabase:
 *   POST /api/revalidate  with  Authorization: Bearer <REVALIDATE_SECRET>
 * Without it, new data appears only when the hourly ISR window lapses.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return Response.json({ error: "REVALIDATE_SECRET not configured" }, { status: 500 });

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!timingSafeEqual(digest(token), digest(secret))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  revalidateTag(CAFES_TAG, { expire: 0 }); // next request refetches; never serve the stale list
  revalidatePath("/");
  return Response.json({ revalidated: true, at: new Date().toISOString() });
}
