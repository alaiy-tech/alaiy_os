/** `lib/frappe/organisation.ts`'s `getOrganisationSettings()` result - the
 * full org profile (Organisation Settings page); `types/company.ts`'s
 * `CompanyInfo` is the smaller cosmetic subset the rest of the app reads. */
export type OrganisationInfo = {
  companyDocName: string;
  companyName: string;
  abbr: string;
  defaultCurrency: string | null;
  country: string | null;
  squareLogoUrl: string | null;
  horizontalLogoUrl: string | null;
};

/** The cosmetic subset of `OrganisationInfo` (`types/organisation.ts`) the
 * rest of the app actually needs at render time - the sidebar's "{Company}
 * OS" label and `formatCurrency`'s default currency. Shared by
 * `lib/frappe/server.ts`'s `getCompanyInfo()` (server-side resolution) and
 * `runtime/store/company/company-provider.tsx`'s `useCompany()` (the client
 * context value) - previously declared independently, identically, in both
 * files. */
export type CompanyInfo = { name: string; defaultCurrency: string | null };
