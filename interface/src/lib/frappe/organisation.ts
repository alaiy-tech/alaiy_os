import type { OrganisationInfo } from "@/types/organisation";

export class OrganisationApiError extends Error {}

async function getSingleValue(
  doctype: string,
  field: string,
): Promise<string | null> {
  const res = await fetch(
    `/api/method/frappe.client.get_single_value?doctype=${encodeURIComponent(doctype)}&field=${encodeURIComponent(field)}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: string | null };
  return data.message ?? null;
}

/** ERPNext keeps "the" default company in Global Defaults.default_company -
 * this mirrors that, falling back to the oldest Company record if it's
 * unset, so the page still works on a freshly-installed site. */
async function resolveDefaultCompanyName(): Promise<string> {
  const defaultCompany = await getSingleValue(
    "Global Defaults",
    "default_company",
  );
  if (defaultCompany) return defaultCompany;

  const fields = encodeURIComponent(JSON.stringify(["name"]));
  const listRes = await fetch(
    `/api/resource/Company?fields=${fields}&order_by=${encodeURIComponent("creation asc")}&limit_page_length=1`,
  );
  if (listRes.ok) {
    const data = (await listRes.json()) as { data?: Array<{ name: string }> };
    if (data.data?.[0]?.name) return data.data[0].name;
  }
  throw new OrganisationApiError(
    "No company has been set up on this site yet.",
  );
}

export async function getOrganisationSettings(): Promise<OrganisationInfo> {
  const companyDocName = await resolveDefaultCompanyName();
  const fields = encodeURIComponent(
    JSON.stringify(["company_name", "abbr", "default_currency", "country"]),
  );
  const res = await fetch(
    `/api/resource/Company/${encodeURIComponent(companyDocName)}?fields=${fields}`,
  );
  if (!res.ok)
    throw new OrganisationApiError("Could not load company details.");
  const { data } = (await res.json()) as {
    data: {
      company_name: string;
      abbr: string;
      default_currency: string | null;
      country: string | null;
    };
  };

  const [squareLogoUrl, horizontalLogoUrl] = await Promise.all([
    getSingleValue("OS Theme Settings", "square_logo"),
    getSingleValue("OS Theme Settings", "horizontal_logo"),
  ]);

  return {
    companyDocName,
    companyName: data.company_name,
    abbr: data.abbr,
    defaultCurrency: data.default_currency,
    country: data.country,
    squareLogoUrl,
    horizontalLogoUrl,
  };
}

/** Applies field changes before any rename - a rename changes the Company
 * doc's `name` (autoname is by company_name), so it must happen last or the
 * field PUT above would 404 against the doc's new name. Returns the doc name
 * to use for any subsequent call (unchanged unless companyName was renamed). */
export async function updateOrganisationSettings(
  companyDocName: string,
  patch: { companyName?: string; defaultCurrency?: string; country?: string },
): Promise<string> {
  const fieldPatch: Record<string, string> = {};
  if (patch.defaultCurrency)
    fieldPatch.default_currency = patch.defaultCurrency;
  if (patch.country) fieldPatch.country = patch.country;

  if (Object.keys(fieldPatch).length > 0) {
    const res = await fetch(
      `/api/resource/Company/${encodeURIComponent(companyDocName)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fieldPatch),
      },
    );
    if (!res.ok) {
      const data = await res
        .json()
        .catch(() => ({}) as Record<string, unknown>);
      throw new OrganisationApiError(
        (data as { message?: string }).message ??
          "Could not update company details.",
      );
    }
  }

  if (patch.companyName && patch.companyName !== companyDocName) {
    const res = await fetch("/api/method/frappe.client.rename_doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctype: "Company",
        old_name: companyDocName,
        new_name: patch.companyName,
      }),
    });
    const data = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (!res.ok) {
      throw new OrganisationApiError(
        (data as { message?: string }).message ??
          "Could not rename the company.",
      );
    }
    return (data as { message?: string }).message ?? patch.companyName;
  }

  return companyDocName;
}

export async function getCurrencyList(): Promise<string[]> {
  const fields = encodeURIComponent(JSON.stringify(["name"]));
  const filters = encodeURIComponent(JSON.stringify([["enabled", "=", 1]]));
  const res = await fetch(
    `/api/resource/Currency?fields=${fields}&filters=${filters}&order_by=name+asc&limit_page_length=500`,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { data?: Array<{ name: string }> };
  return (data.data ?? []).map((row) => row.name);
}

export async function getCountryList(): Promise<string[]> {
  const fields = encodeURIComponent(JSON.stringify(["name"]));
  const res = await fetch(
    `/api/resource/Country?fields=${fields}&order_by=name+asc&limit_page_length=300`,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { data?: Array<{ name: string }> };
  return (data.data ?? []).map((row) => row.name);
}

export async function uploadOrganisationLogo(
  file: File,
  logoType: "square" | "horizontal",
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(
    `/api/method/alaiy_os.api.theme.upload_organisation_logo?logo_type=${logoType}`,
    {
      method: "POST",
      body: formData,
    },
  );
  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    throw new OrganisationApiError(
      (data as { message?: string }).message ?? "Could not upload the logo.",
    );
  }
  return (data as { message?: { file_url?: string } }).message?.file_url ?? "";
}
