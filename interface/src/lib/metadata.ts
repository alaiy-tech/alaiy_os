// Server-only (pulls in lib/frappe/config.ts's server-only getFrappeUrl()) -
// the one place every baseline/dynamic page builds its Next.js `Metadata`
// from, so title/openGraph/twitter/robots stay one shape instead of ~15
// hand-rolled copies. The deployment domain doubles as the public site
// origin (nginx fronts both the Frappe bench and this Next.js app on the
// same host - see next.config.mjs's `/frappe-assets/*` rewrite), so
// `getFrappeUrl()` is also this app's `metadataBase` (root layout) - every
// relative URL below (route, OG image) resolves against it automatically.
import type { Metadata } from "next";

import { getFrappeUrl } from "@/lib/frappe/config";

export const SITE_NAME = "Alaiy OS";

/** Bench-relative - no dedicated social-preview image exists in this repo
 * yet. Drop a real PNG at this path in the bench's shared assets dir
 * (`sites/assets/images/`, the same directory `lib/frappe/server.ts`'s
 * `getOrganisationLogoSrc()` already writes the org's logo files into) to
 * make every page's link preview real; until then this 404s like any other
 * missing asset; a preview surface that has no image just shows none. */
export const OG_IMAGE_PATH = "/assets/images/og-image.png";

/** Root layout's `metadataBase` - every other page's relative `route`/OG
 * image path resolves against this. */
export function siteMetadataBase(): URL {
  return new URL(getFrappeUrl());
}

export type PageMetadataInput = {
  /** The resolved org name (`getCompanyInfo()`) - `null` falls back to the
   * plain `SITE_NAME` brand instead of "null OS". */
  companyName: string | null;
  /** e.g. "Ask Alaiy", "Settings - Organisation" - combined into
   * "<Company> OS | <pageTitle>" ("Alaiy OS | <pageTitle>" with no resolved
   * company). */
  pageTitle: string;
  description: string;
  keywords?: string[];
  /** This page's own route (e.g. "/os/ask-alaiy") - resolved to an absolute
   * URL via `metadataBase` for `openGraph.url`. */
  route: string;
};

function normaliseDisplayName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
    .join(" ");
}

function brandName(companyName: string | null): string {
  return companyName ? `${normaliseDisplayName(companyName)} OS` : SITE_NAME;
}

/** The full Metadata shape every baseline/dynamic page shares: title,
 * description, applicationName, keywords, openGraph, twitter, and a
 * permissive-by-default robots directive (a client OS deployment has no
 * reason to opt out of indexing by default - a page that should, can still
 * override `robots` after calling this). */
export function buildPageMetadata({
  companyName,
  pageTitle,
  description,
  keywords,
  route,
}: PageMetadataInput): Metadata {
  const title = `${brandName(companyName)} | ${pageTitle}`;

  return {
    title,
    description,
    applicationName: SITE_NAME,
    keywords,
    openGraph: {
      title,
      description,
      url: route,
      siteName: SITE_NAME,
      locale: "en_US",
      images: [{ url: OG_IMAGE_PATH, alt: description }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE_PATH],
    },
    robots: {
      index: true,
      follow: true,
      nocache: false,
      googleBot: {
        index: true,
        follow: true,
        noimageindex: false,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}
