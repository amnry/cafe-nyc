import { getDeps } from "@/lib/speedtest/deps";
import { handleSubmit } from "@/lib/speedtest/submit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const deps = getDeps();
  if (!deps) return Response.json({ error: "speed test not configured" }, { status: 500 });
  return handleSubmit(request, deps);
}
