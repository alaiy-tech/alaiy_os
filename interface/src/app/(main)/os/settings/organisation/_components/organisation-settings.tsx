"use client";

import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getCountryList,
  getCurrencyList,
  getOrganisationSettings,
  OrganisationApiError,
  type OrganisationInfo,
  updateOrganisationSettings,
  uploadOrganisationLogo,
} from "@/lib/frappe/organisation";

type LogoType = "square" | "horizontal";

function LogoUploadField({
  label,
  description,
  previewUrl,
  aspect,
  isUploading,
  onSelect,
}: {
  label: string;
  description: string;
  previewUrl: string | null;
  aspect: "square" | "wide";
  isUploading: boolean;
  onSelect: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={`logo-${label}`}>{label}</FieldLabel>
      <div className="flex items-center gap-4">
        <div
          className={
            aspect === "square"
              ? "flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted"
              : "flex h-16 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted"
          }
        >
          {previewUrl ? (
            <img src={previewUrl} alt={label} className="size-full object-contain" />
          ) : (
            <UploadCloud className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            ref={inputRef}
            id={`logo-${label}`}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              if (file) onSelect(file);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? "Uploading…" : "Upload image"}
          </Button>
          <p className="max-w-xs text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function OrganisationSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState<Record<LogoType, boolean>>({ square: false, horizontal: false });

  const [info, setInfo] = useState<OrganisationInfo | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("");
  const [country, setCountry] = useState("");
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getOrganisationSettings(), getCurrencyList(), getCountryList()])
      .then(([settings, currencyList, countryList]) => {
        if (cancelled) return;
        setInfo(settings);
        setCompanyName(settings.companyName);
        setDefaultCurrency(settings.defaultCurrency ?? "");
        setCountry(settings.country ?? "");
        setCurrencies(currencyList);
        setCountries(countryList);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(error instanceof OrganisationApiError ? error.message : "Could not load organisation settings.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    if (!info) return;
    setIsSaving(true);
    try {
      const newDocName = await updateOrganisationSettings(info.companyDocName, {
        companyName: companyName !== info.companyName ? companyName : undefined,
        defaultCurrency: defaultCurrency !== (info.defaultCurrency ?? "") ? defaultCurrency : undefined,
        country: country !== (info.country ?? "") ? country : undefined,
      });
      setInfo({ ...info, companyDocName: newDocName, companyName, defaultCurrency, country });
      toast.success("Organisation settings saved.");
    } catch (error) {
      toast.error(error instanceof OrganisationApiError ? error.message : "Could not save organisation settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogoUpload(file: File, logoType: LogoType) {
    setUploading((prev) => ({ ...prev, [logoType]: true }));
    try {
      const fileUrl = await uploadOrganisationLogo(file, logoType);
      setInfo((prev) =>
        prev
          ? {
              ...prev,
              squareLogoUrl: logoType === "square" ? fileUrl : prev.squareLogoUrl,
              horizontalLogoUrl: logoType === "horizontal" ? fileUrl : prev.horizontalLogoUrl,
            }
          : prev,
      );
      toast.success("Logo uploaded.");
    } catch (error) {
      toast.error(error instanceof OrganisationApiError ? error.message : "Could not upload the logo.");
    } finally {
      setUploading((prev) => ({ ...prev, [logoType]: false }));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Organisation"
        subtitle="Manage your company's identity and branding."
        action={
          <Button type="button" onClick={handleSave} disabled={isLoading || isSaving || !info}>
            {isSaving ? "Saving…" : "Save Changes"}
          </Button>
        }
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Company</CardTitle>
          <CardDescription>Your organisation's registered identity, currency, and country.</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <FieldGroup className="grid gap-6 sm:grid-cols-2">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="org-company-name">Company Name</FieldLabel>
              <Input
                id="org-company-name"
                value={companyName}
                disabled={isLoading}
                onChange={(event) => setCompanyName(event.target.value)}
              />
            </Field>

            <Field className="gap-1.5">
              <FieldLabel htmlFor="org-abbr">Abbr</FieldLabel>
              <Input id="org-abbr" value={info?.abbr ?? ""} disabled />
              <FieldDescription>Set when the company was created - cannot be changed here.</FieldDescription>
            </Field>

            <Field className="gap-1.5">
              <FieldLabel htmlFor="org-currency">Default Currency</FieldLabel>
              <Select value={defaultCurrency} onValueChange={setDefaultCurrency} disabled={isLoading}>
                <SelectTrigger id="org-currency" className="w-full">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {currencies.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field className="gap-1.5">
              <FieldLabel htmlFor="org-country">Country</FieldLabel>
              <Select value={country} onValueChange={setCountry} disabled={isLoading}>
                <SelectTrigger id="org-country" className="w-full">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {countries.map((countryOption) => (
                      <SelectItem key={countryOption} value={countryOption}>
                        {countryOption}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Organisational Assets</CardTitle>
          <CardDescription>Upload the logos used across the OS - sidebar, login screen, and desk.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 pt-2">
          <LogoUploadField
            label="Square Logo"
            description="Used in the sidebar, favicon, and app switcher. Square images work best."
            previewUrl={info?.squareLogoUrl ?? null}
            aspect="square"
            isUploading={uploading.square}
            onSelect={(file) => handleLogoUpload(file, "square")}
          />
          <LogoUploadField
            label="Horizontal Logo"
            description="Used on the login screen and desk navbar. Wide images work best."
            previewUrl={info?.horizontalLogoUrl ?? null}
            aspect="wide"
            isUploading={uploading.horizontal}
            onSelect={(file) => handleLogoUpload(file, "horizontal")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
