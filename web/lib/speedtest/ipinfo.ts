import "server-only";

export interface AsnInfo {
  asn: number;
  asn_org: string | null;
}

/** ASN for an IP via the ipinfo lite API. Null on any failure (callers fail closed). */
export async function lookupAsn(ip: string, token: string, fetchImpl: typeof fetch = fetch): Promise<AsnInfo | null> {
  try {
    const res = await fetchImpl(`https://api.ipinfo.io/lite/${encodeURIComponent(ip)}?token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { asn?: string | number; as_name?: string };
    const asn = typeof body.asn === "number" ? body.asn : Number(String(body.asn ?? "").replace(/^AS/i, ""));
    if (!Number.isInteger(asn) || asn <= 0) return null;
    return { asn, asn_org: body.as_name ?? null };
  } catch {
    return null;
  }
}
