import type { Metadata } from "next";
import { Geist, Inter, JetBrains_Mono, Playfair_Display, Poppins } from "next/font/google";
import "./globals.css";

/**
 * Five faces, each with one job.
 *
 * Playfair Display is read once — headlines, the greeting, a figure shown
 * off. Poppins is read at length: headings H3-H6, body copy, labels, nav,
 * buttons. Inter is loaded and tokenized (`--font-body`) but not yet the
 * rendered default anywhere — see Adoption Status in DESIGN.md. JetBrains
 * Mono carries the Eyebrow and small-caps tags. Geist carries what a seller
 * reads a thousand rows of, where Poppins' width and its proportional
 * numerals work against scanning a column of money. See `--font-display`,
 * `--font-heading`, `--font-sans`, `--font-body`, `--font-label` and
 * `--font-data` in globals.css.
 */
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
});
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
      className={`${playfair.variable} ${poppins.variable} ${inter.variable} ${jetbrainsMono.variable} ${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-canvas font-sans text-ink">{children}</body>
    </html>
  );
}
