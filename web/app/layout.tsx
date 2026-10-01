import type { Metadata } from "next";
import { Barlow_Condensed, Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
});

const display = Barlow_Condensed({
  variable: "--font-display-face",
  weight: ["600", "700"],
  subsets: ["latin"],
});

const TITLE = "Find your 3rd place · NYC";
const DESCRIPTION = "Not home, not the office. Scouted cafes in NYC for working, meeting and studying.";

export const metadata: Metadata = {
  metadataBase: new URL("https://cafe-nyc.vercel.app"),
  title: TITLE,
  description: DESCRIPTION,
  // og:image / twitter:image come from app/opengraph-image.tsx and app/twitter-image.tsx
  openGraph: {
    type: "website",
    url: "/",
    siteName: "3rd place",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${mono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
