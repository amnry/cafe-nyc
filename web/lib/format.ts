/** "204 W 10th St" from "204 W 10th St, New York, NY 10014, USA". */
export function shortAddress(address: string | null): string | null {
  const first = address?.split(",")[0]?.trim();
  return first || null;
}

/** Street line for display: the ETL's addressComponents-based value, else the first address segment. */
export function streetLine(street: string | null, address: string | null): string | null {
  return street || shortAddress(address);
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}
