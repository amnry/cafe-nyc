// ASNs we refuse to take speed tests from. Every entry needs a source URL (bgp.he.net or PeeringDB).
// Holder names were checked against RIPEstat on 2026-10-01 (bgp.he.net blocks scripted access).
// Look an ASN up before adding it: a wrong number blocks (or admits) real users. The first draft of
// this list had two numbers that belonged to other companies.

export interface AsnEntry {
  asn: number;
  name: string;
  source: string;
}

const he = (asn: number) => `https://bgp.he.net/AS${asn}`;

// US mobile carriers. Wireline ASNs are deliberately absent: Verizon Fios (AS701) and AT&T
// wireline (AS7018) are home/cafe internet.
// Known false negatives: T-Mobile Home Internet shares AS21928 with T-Mobile mobile, so a cafe on it
// can never be tested. Verizon 5G Home / business fixed wireless (AS6167) is blocked the same way.
// Smaller carriers (US Cellular, Dish/Boost, regional) are not listed; add them with a verified source.
export const MOBILE_ASNS: readonly AsnEntry[] = [
  { asn: 21928, name: "T-Mobile USA", source: he(21928) },
  { asn: 6167, name: "Verizon Wireless (CELLCO-PART)", source: he(6167) },
  { asn: 22394, name: "Verizon Wireless (CELLCO)", source: he(22394) },
  { asn: 20057, name: "AT&T Mobility", source: he(20057) },
];

// Hosting, cloud and VPN egress. ipinfo's lite API has no VPN/hosting flag, so detection is list-only.
// iCloud Private Relay is handled separately by IP range (private-relay.ts).
export const HOSTING_VPN_ASNS: readonly AsnEntry[] = [
  { asn: 16509, name: "Amazon (AMAZON-02)", source: he(16509) },
  { asn: 14618, name: "Amazon (AMAZON-AES)", source: he(14618) },
  { asn: 15169, name: "Google", source: he(15169) },
  { asn: 396982, name: "Google Cloud Platform", source: he(396982) },
  { asn: 8075, name: "Microsoft", source: he(8075) },
  { asn: 14061, name: "DigitalOcean", source: he(14061) },
  { asn: 16276, name: "OVH", source: he(16276) },
  { asn: 24940, name: "Hetzner", source: he(24940) },
  { asn: 63949, name: "Akamai Connected Cloud (Linode)", source: he(63949) },
  { asn: 20473, name: "Vultr (The Constant Company)", source: he(20473) },
  { asn: 13335, name: "Cloudflare (incl. WARP)", source: he(13335) },
  { asn: 9009, name: "M247 (VPN hosting)", source: he(9009) },
  { asn: 60068, name: "Datacamp / CDN77", source: he(60068) },
  { asn: 212238, name: "Datacamp (CDNEXT)", source: he(212238) },
  { asn: 60781, name: "Leaseweb NL", source: he(60781) },
  { asn: 30633, name: "Leaseweb USA", source: he(30633) },
  { asn: 31898, name: "Oracle Cloud", source: he(31898) },
  { asn: 54113, name: "Fastly", source: he(54113) },
  { asn: 36351, name: "IBM Cloud (SoftLayer)", source: he(36351) },
  { asn: 45102, name: "Alibaba Cloud (US)", source: he(45102) },
  { asn: 62240, name: "Clouvider", source: he(62240) },
  { asn: 53667, name: "FranTech (PonyNet)", source: he(53667) },
];
