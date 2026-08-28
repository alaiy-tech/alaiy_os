import type { ReactNode } from "react";

import type { Metadata } from "next";

import { TooltipProvider } from "@/components/primitive/tooltip";
import { APP_CONFIG } from "@/config/app-config";
import { fontVars } from "@/config/fonts";
import { getCompanyInfo, getOrganisationLogoSrc, getServerUser } from "@/lib/frappe/server";
import { siteMetadataBase } from "@/lib/metadata";
import { AuthProvider } from "@/runtime/store/auth/auth-provider";
import { PreferencesStoreProvider } from "@/runtime/store/preferences/preferences-provider";
import { ThemeBootScript } from "@/scripts/theme-boot";
import { getAllPreferences } from "@/server/server-actions";

import { Toaster } from "../components/primitive/sonner";

import "../styles/globals.css";

/** The favicon is the org's uploaded square logo when set (`OS Theme
 * Settings`, same source `lib/frappe/server.ts`'s `getOrganisationLogoSrc()`
 * resolves for the sidebars), falling back to this app's own default -
 * dynamic per request, so `generateMetadata` rather than a static `metadata`
 * export. Also where `metadataBase` is set once for the whole app - every
 * other page's `generateMetadata` (`lib/metadata.ts`'s `buildPageMetadata`)
 * hands back a relative `route`/OG image path, resolved against this. Every
 * real page overrides `title`/`description` with its own full literal
 * string, so this is only ever seen as a fallback (a route with no
 * `generateMetadata` of its own). */
export async function generateMetadata(): Promise<Metadata> {
  const [logoSrc, company] = await Promise.all([
    getOrganisationLogoSrc(),
    getCompanyInfo(),
  ]);
  return {
    metadataBase: siteMetadataBase(),
    title: company?.name ? `${company.name} OS` : APP_CONFIG.meta.title,
    description: APP_CONFIG.meta.description,
    icons: {
      icon: logoSrc.square,
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [preferences, user] = await Promise.all([getAllPreferences(), getServerUser()]);
  const { theme_mode, theme_preset, content_layout, navbar_style, sidebar_variant, sidebar_collapsible, font } =
    preferences;
  return (
    <html
      lang="en"
      data-theme-mode={theme_mode}
      data-theme-preset={theme_preset}
      data-content-layout={content_layout}
      data-navbar-style={navbar_style}
      data-sidebar-variant={sidebar_variant}
      data-sidebar-collapsible={sidebar_collapsible}
      data-font={font}
      suppressHydrationWarning
    >
      <head>
        {/* Applies theme and layout preferences on load to avoid flicker and unnecessary server rerenders. */}
        <ThemeBootScript />
      </head>
      <body className={`${fontVars} min-h-screen antialiased`}>
        <TooltipProvider>
          <AuthProvider initialUser={user}>
            <PreferencesStoreProvider initialValues={preferences}>
              {children}
              <Toaster />
            </PreferencesStoreProvider>
          </AuthProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
