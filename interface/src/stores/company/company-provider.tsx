"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { getOrganisationSettings } from "@/lib/frappe/organisation";

export type CompanyInfo = { name: string; defaultCurrency: string | null };

type CompanyContextValue = {
  company: CompanyInfo | null;
  /** Falls back to "USD" - matches formatCurrency's own default - so callers
   * never have to null-check before formatting a money figure. */
  defaultCurrency: string;
  refresh: () => Promise<void>;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

// Mounted once in the os layout, seeded with the company resolved
// server-side (getCompanyInfo()) so there's no loading flash on first paint.
// `refresh` lets Organisation Settings push a saved name/currency change into
// every other mounted page (sidebar, KPI cards, tables) without a full reload.
export function CompanyProvider({
  initialCompany,
  children,
}: {
  readonly initialCompany: CompanyInfo | null;
  readonly children: ReactNode;
}) {
  const [company, setCompany] = useState<CompanyInfo | null>(initialCompany);

  const refresh = useCallback(async () => {
    try {
      const settings = await getOrganisationSettings();
      setCompany({ name: settings.companyName, defaultCurrency: settings.defaultCurrency });
    } catch {
      // Keep the last-known company/currency rather than clearing it out.
    }
  }, []);

  const value = useMemo(
    () => ({ company, defaultCurrency: company?.defaultCurrency || "USD", refresh }),
    [company, refresh],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within a CompanyProvider");
  return ctx;
}
