// Machine-readable reject reasons, with the plain-English text the drawer shows and the HTTP status.
// Shared by the API (server) and the drawer (client): no secrets or server-only imports here.

export const REJECT_REASONS = {
  // start
  bad_request: { status: 400, message: "Something went wrong with that request. Please try again." },
  no_client_ip: { status: 400, message: "We couldn't tell which network you're on. Please try again." },
  turnstile_failed: { status: 403, message: "We couldn't verify you're a person. Please try again." },
  cafe_not_found: { status: 404, message: "We couldn't find that cafe." },
  private_relay: { status: 403, message: "Turn off Private Relay for this site, or use Chrome." },
  low_accuracy: {
    status: 403,
    message: "Your location isn't precise enough. Try again with Wi-Fi on and location set to precise.",
  },
  too_far: { status: 403, message: "You need to be at the cafe to test its WiFi." },
  mobile_network: { status: 403, message: "You're on a mobile network. Connect to the cafe's WiFi and try again." },
  vpn_or_hosting: { status: 403, message: "You appear to be on a VPN or proxy. Turn it off and try again." },
  asn_lookup_failed: { status: 503, message: "We couldn't check your network right now. Please try again in a bit." },
  rate_limited_cafe: { status: 429, message: "This cafe has been tested a lot in the last hour. Try again later." },
  rate_limited_device: { status: 429, message: "You've run a lot of tests today. Try again tomorrow." },
  // submit
  invalid_token: { status: 400, message: "That test session isn't valid. Please start again." },
  token_expired: { status: 400, message: "That test took too long to finish. Please start again." },
  nonce_reused: { status: 409, message: "That result was already submitted." },
  ip_changed: { status: 400, message: "Your network changed during the test. Please start again." },
  too_fast: { status: 400, message: "That result came back too quickly to be real. Please start again." },
  too_slow: { status: 400, message: "That test took too long to finish. Please start again." },
  implausible_results: { status: 400, message: "Those results didn't look right. Please try again." },
} as const;

export type RejectReason = keyof typeof REJECT_REASONS;

export function rejection(reason: RejectReason): Response {
  const { status, message } = REJECT_REASONS[reason];
  return Response.json({ status: "rejected", reason, message }, { status });
}
