import type { ConfigOptions } from "@cloudflare/speedtest";

/**
 * Measurement sequence sized for a ~15 s run on a normal connection (the library default runs far
 * longer). Option names are from the @cloudflare/speedtest 1.14.1 README. No packet-loss measurement
 * (it needs a TURN server). If a normal connection runs over ~18 s, tune the counts here.
 */
export const SPEEDTEST_CONFIG: ConfigOptions = {
  autoStart: false, // runs only on explicit user action
  measurements: [
    { type: "latency", numPackets: 10 },
    { type: "download", bytes: 1e5, count: 1, bypassMinDuration: true }, // initial estimate
    { type: "download", bytes: 1e6, count: 4 },
    { type: "download", bytes: 1e7, count: 3 },
    { type: "download", bytes: 2.5e7, count: 1 },
    { type: "upload", bytes: 1e5, count: 2, bypassMinDuration: true },
    { type: "upload", bytes: 1e6, count: 4 },
    { type: "upload", bytes: 5e6, count: 2 },
  ],
  // Library default: stop stepping up to larger files once a set takes ~1 s, so fast networks still
  // reach the big files and slow ones stop early.
  bandwidthFinishRequestDuration: 1000,
  measureDownloadLoadedLatency: false,
  measureUploadLoadedLatency: false,
};
