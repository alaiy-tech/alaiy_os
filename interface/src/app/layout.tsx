import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

/**
 * Three faces, each with one job — the landing page's own typographic set,
 * brought into the product so a seller meets one voice across both.
 *
 * Geist carries everything that is read at length: headings H3-H6, body
 * copy, labels, nav, buttons, page titles. Geist Mono carries every figure
 * and every eyebrow — the landing sets counters, KPI figures, tab labels and
 * section eyebrows in mono, which is the opposite of the system this file
 * carried before (Poppins with tabular-nums, under a "no separate data face"
 * rule). That rule is deliberately retired here: the mono IS the data face.
 *
 * Instrument Serif is loaded at 400 with its italic, and is only ever used
 * italic, via the `.serif` class — the accent half of a split headline
 * ("Your store data, *answerable.*"), never a whole heading and never body
 * copy. See `--font-display`, `--font-sans`, `--font-label` and `--font-data`
 * in globals.css.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    // The product is "Alaiy". Never "Alaiy OS" — that is the backend's name,
    // and a seller has no reason to ever meet it.
    default: "Alaiy",
    template: "%s",
  },
  description:
    "Connect your Shopify and Amazon data to AI. Access it, ask about it, act on it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-canvas font-sans text-ink">{children}</body>
    </html>
  );
}
