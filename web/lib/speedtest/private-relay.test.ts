import { describe, expect, it } from "vitest";
import { createRelayMatcher, isPrivateRelayIp } from "./private-relay";

describe("createRelayMatcher", () => {
  const match = createRelayMatcher({ v4: ["172.224.226.0/27", "104.28.28.76/32"], v6: ["2a02:26f7:b3c0::/48"] });
  it("matches inside CIDRs, including a /32 and the last address", () => {
    expect(match("172.224.226.0")).toBe(true);
    expect(match("172.224.226.31")).toBe(true);
    expect(match("104.28.28.76")).toBe(true);
    expect(match("2a02:26f7:b3c0:1::5")).toBe(true);
  });
  it("does not match outside", () => {
    expect(match("172.224.226.32")).toBe(false);
    expect(match("104.28.28.77")).toBe(false);
    expect(match("2a02:26f7:b3c1::1")).toBe(false);
    expect(match("not-an-ip")).toBe(false);
  });
  it("matches a v4-mapped v6 address as IPv4", () => expect(match("::ffff:172.224.226.5")).toBe(true));
});

describe("Apple egress snapshot", () => {
  it("is loaded and recognises a range from the published list", () => {
    expect(isPrivateRelayIp("172.224.226.5")).toBe(true); // first rows of Apple's CSV
    expect(isPrivateRelayIp("8.8.8.8")).toBe(false);
    expect(isPrivateRelayIp("203.0.113.7")).toBe(false);
  });
});
