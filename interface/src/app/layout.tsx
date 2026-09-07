import type { Metadata } from "next";
import { Geist, Playfair_Display, Poppins } from "next/font/google";
import "./globals.css";

/**
 * Three faces, each with one job.
 *
 * Playfair Display is the voice: headings, the greeting, a figure being shown
 * off. Poppins is everything read at length — body copy, labels, nav, buttons.
 * Geist carries what a seller reads a thousand rows of, where Poppins' width
 * and its proportional numerals work against scanning a column of money. See
 * `--font-display`, `--font-sans` and `--font-data` in globals.css.
 */
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  // 700 is the heading weight; 400 italic is the pull-quote in the system, and
  // is what a question in Alaiy's own voice is set in.
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

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
      className={`${playfair.variable} ${poppins.variable} ${geistSans.variable} h-full antialiased`}
    >
      {/* The grain is painted by `body::before` rather than by an element
          here — one fixed layer over everything, including what floats. */}
      <body className="min-h-full bg-canvas font-sans text-ink">{children}</body>
    </html>
  );
}
