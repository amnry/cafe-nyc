import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Find your 3rd place. Not home, not the office, scouted cafes in NYC.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const display = await readFile(join(process.cwd(), "assets/BarlowCondensed-Bold.ttf"));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#0c0c0b",
          color: "#ecebe4",
          borderLeft: "16px solid #ffb224",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 8, color: "#ffb224", textTransform: "uppercase" }}>
          New York City
        </div>
        <div style={{ fontFamily: "Barlow Condensed", fontSize: 168, lineHeight: 0.95, marginTop: 20, textTransform: "uppercase" }}>
          Find your 3rd place
        </div>
        <div style={{ fontSize: 36, color: "#8d8c82", marginTop: 32 }}>not home, not the office, scouted cafes in NYC</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Barlow Condensed", data: display, style: "normal", weight: 700 }] },
  );
}
