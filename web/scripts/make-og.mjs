// Regenerates app/opengraph-image.png and app/twitter-image.png (1200x630) from the site's look:
// amber page, Barlow Condensed display font, faded Manhattan map from etl/data/nta_targets.geojson.
//   node scripts/make-og.mjs [cafe count]
// The headline figure is static text: re-run this when the cafe count changes noticeably.
import { readFileSync, writeFileSync } from "node:fs";
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";

const root = new URL("../", import.meta.url);
const count = Number(process.argv[2] ?? 1430).toLocaleString("en-US");
const INK = "#1a1203";
const AMBER = "#ffb224";
const PAPER = "#fbfaf6";

const display = readFileSync(new URL("assets/BarlowCondensed-Bold.ttf", root));
const sans = readFileSync(new URL("node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf", root));

// --- faded Manhattan: NTA polygons (MN* only), north-up, local equirectangular projection ---
const geo = JSON.parse(readFileSync(new URL("../etl/data/nta_targets.geojson", root), "utf8"));
const polys = geo.features
  .filter((f) => f.properties.nta2020.startsWith("MN"))
  .flatMap((f) => (f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates]));
const KX = Math.cos((40.78 * Math.PI) / 180);
const pts = polys.flat(2);
const lngs = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
const [w0, e0, s0, n0] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)];
const MAP_H = 760; // taller than the card: the island bleeds off the top and bottom
const scale = MAP_H / (n0 - s0);
const MAP_W = Math.ceil((e0 - w0) * KX * scale);
const proj = ([lng, lat]) => [(lng - w0) * KX * scale, (n0 - lat) * scale];
const path = polys
  .map((rings) => rings.map((ring) => "M" + ring.map((p) => proj(p).map((v) => v.toFixed(1)).join(",")).join("L") + "Z").join(""))
  .join("");

// A few pins at deterministic spots inside the island.
const inRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pins = [];
while (pins.length < 16) {
  const lng = w0 + rnd() * (e0 - w0), lat = s0 + rnd() * (n0 - s0);
  if (!polys.some((rings) => inRing(lng, lat, rings[0]))) continue;
  const [x, y] = proj([lng, lat]);
  if (pins.every(([px, py]) => Math.hypot(px - x, py - y) > 60)) pins.push([x, y]);
}
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_W}" height="${MAP_H}" viewBox="0 0 ${MAP_W} ${MAP_H}">` +
  `<path d="${path}" fill="${INK}" fill-opacity="0.10" stroke="${INK}" stroke-opacity="0.22" stroke-width="1.5" stroke-linejoin="round"/>` +
  pins.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="16" fill="${PAPER}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="${AMBER}" stroke="${INK}" stroke-width="3.5"/>`).join("") +
  `</svg>`;
const mapSrc = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");

const el = h(
  "div",
  { style: { width: "100%", height: "100%", display: "flex", background: AMBER, position: "relative" } },
  h("img", { src: mapSrc, width: MAP_W, height: MAP_H, style: { position: "absolute", right: 30, top: (630 - MAP_H) / 2, transform: "rotate(0deg)" } }),
  h(
    "div",
    { style: { display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 80px", width: 800, height: "100%" } },
    h("div", { style: { display: "flex", flexDirection: "column", fontFamily: "Barlow", fontWeight: 700, fontSize: 168, lineHeight: 0.95, letterSpacing: 2, color: INK } },
      h("div", { style: { display: "flex" } }, "Find your"),
      h("div", { style: { display: "flex" } }, "3rd Place")),
    h("div", { style: { display: "flex", marginTop: 34, fontFamily: "Geist", fontSize: 29, color: INK, whiteSpace: "nowrap" } }, "not home, not the office, scouted cafes in NYC"),
    h("div", { style: { display: "flex", marginTop: 30, alignSelf: "flex-start", background: INK, color: PAPER, fontFamily: "Geist", fontSize: 26, padding: "12px 22px", whiteSpace: "nowrap" } },
      `${count} cafes across Manhattan · real WiFi speeds`),
  ),
);

const res = new ImageResponse(el, {
  width: 1200, height: 630,
  fonts: [{ name: "Barlow", data: display, weight: 700, style: "normal" }, { name: "Geist", data: sans, weight: 400, style: "normal" }],
});
const png = Buffer.from(await res.arrayBuffer());
for (const name of ["opengraph-image.png", "twitter-image.png"]) writeFileSync(new URL(`app/${name}`, root), png);
const alt = `Find your 3rd Place. not home, not the office, scouted cafes in NYC. ${count} cafes across Manhattan with real WiFi speeds.`;
for (const name of ["opengraph-image.alt.txt", "twitter-image.alt.txt"]) writeFileSync(new URL(`app/${name}`, root), alt);
console.log(`wrote 2 images (${png.length} bytes each)`);
