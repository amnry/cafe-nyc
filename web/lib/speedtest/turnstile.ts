import "server-only";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileExpect {
  action: string;
  hostname: string;
}

/**
 * Siteverify (server-side only). Passes when Cloudflare says success and, if `expect` is given, the
 * token was issued for our action on the hostname that is calling us. Pass `expect: null` in local
 * development: Turnstile's test keys return a placeholder hostname and no action.
 */
export async function verifyTurnstile(
  token: string,
  ip: string,
  secret: string,
  fetchImpl: typeof fetch = fetch,
  expect: TurnstileExpect | null = null,
): Promise<boolean> {
  try {
    const res = await fetchImpl(SITEVERIFY, {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { success?: boolean; action?: string; hostname?: string };
    if (body.success !== true) return false;
    if (expect && (body.action !== expect.action || body.hostname?.toLowerCase() !== expect.hostname.toLowerCase())) return false;
    return true;
  } catch {
    return false;
  }
}
