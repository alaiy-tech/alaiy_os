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
