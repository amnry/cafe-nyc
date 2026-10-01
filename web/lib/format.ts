/** "204 W 10th St" from "204 W 10th St, New York, NY 10014, USA". */
export function shortAddress(address: string | null): string | null {
  const first = address?.split(",")[0]?.trim();
  return first || null;
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}
