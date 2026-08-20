"use client";

import { Check } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type FontKey, fontOptions } from "@/lib/fonts/registry";
import type { ContentLayout, NavbarStyle, SidebarCollapsible, SidebarVariant } from "@/lib/preferences/layout";
import { THEME_PRESET_OPTIONS, type ThemeMode, type ThemePreset } from "@/lib/preferences/theme";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

export function ThemeSettings() {
  const { values, resolvedThemeMode, setPreference, resetPreferences } = usePreferencesStore(
    useShallow((state) => ({
      values: state.values,
      resolvedThemeMode: state.resolvedThemeMode,
      setPreference: state.setPreference,
      resetPreferences: state.resetPreferences,
    })),
  );

  const {
    theme_mode: themeMode,
    theme_preset: themePreset,
    content_layout: contentLayout,
    navbar_style: navbarStyle,
    sidebar_variant: variant,
    sidebar_collapsible: collapsible,
    font,
  } = values;

  const onThemePresetChange = (preset: ThemePreset) => {
    setPreference("theme_preset", preset);
  };

  const onThemeModeChange = (mode: ThemeMode | "") => {
    if (!mode) return;
    setPreference("theme_mode", mode);
  };

  const onContentLayoutChange = (layout: ContentLayout | "") => {
    if (!layout) return;
    setPreference("content_layout", layout);
  };

  const onNavbarStyleChange = (style: NavbarStyle | "") => {
    if (!style) return;
    setPreference("navbar_style", style);
  };

  const onSidebarStyleChange = (value: SidebarVariant | "") => {
    if (!value) return;
    setPreference("sidebar_variant", value);
  };

  const onSidebarCollapseModeChange = (value: SidebarCollapsible | "") => {
    if (!value) return;
    setPreference("sidebar_collapsible", value);
  };

  const onFontChange = (value: FontKey | "") => {
    if (!value) return;
    setPreference("font", value);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Theme"
        subtitle="Customize the look, feel, and layout of your workspace."
        action={
          <Button type="button" variant="outline" onClick={resetPreferences}>
            Restore Defaults
          </Button>
        }
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Pick a color preset, mode, and font for the interface.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 pt-2">
          <div className="space-y-2">
            <Label className="font-medium text-sm">Theme Preset</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {THEME_PRESET_OPTIONS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => onThemePresetChange(preset.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent",
                    themePreset === preset.value ? "border-primary ring-1 ring-primary" : "border-border",
                  )}
                >
                  <span
                    className="size-4 shrink-0 rounded-full border"
                    style={{
                      backgroundColor: resolvedThemeMode === "dark" ? preset.primary.dark : preset.primary.light,
                    }}
                  />
                  <span className="font-medium">{preset.label}</span>
                  {themePreset === preset.value && <Check className="ml-auto size-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="font-medium text-sm">Theme Mode</Label>
              <ToggleGroup
                size="sm"
                spacing={0}
                variant="outline"
                type="single"
                className="w-full"
                value={themeMode}
                onValueChange={onThemeModeChange}
              >
                <ToggleGroupItem className="flex-1" value="light" aria-label="Toggle light">
                  Light
                </ToggleGroupItem>
                <ToggleGroupItem className="flex-1" value="dark" aria-label="Toggle dark">
                  Dark
                </ToggleGroupItem>
                <ToggleGroupItem className="flex-1" value="system" aria-label="Toggle system">
                  System
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-2">
              <Label className="font-medium text-sm">Font</Label>
              <Select value={font} onValueChange={onFontChange}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="Select font" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {fontOptions.map((fontOption) => (
                      <SelectItem key={fontOption.key} value={fontOption.key}>
                        {fontOption.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Layout</CardTitle>
          <CardDescription>Control how the sidebar, navbar, and page content are arranged.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 pt-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="font-medium text-sm">Page Layout</Label>
            <ToggleGroup
              size="sm"
              spacing={0}
              variant="outline"
              type="single"
              className="w-full"
              value={contentLayout}
              onValueChange={onContentLayoutChange}
            >
              <ToggleGroupItem className="flex-1" value="centered" aria-label="Toggle centered">
                Centered
              </ToggleGroupItem>
              <ToggleGroupItem className="flex-1" value="full-width" aria-label="Toggle full-width">
                Full Width
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label className="font-medium text-sm">Navbar Behavior</Label>
            <ToggleGroup
              size="sm"
              spacing={0}
              variant="outline"
              type="single"
              className="w-full"
              value={navbarStyle}
              onValueChange={onNavbarStyleChange}
            >
              <ToggleGroupItem className="flex-1" value="sticky" aria-label="Toggle sticky">
                Sticky
              </ToggleGroupItem>
              <ToggleGroupItem className="flex-1" value="scroll" aria-label="Toggle scroll">
                Scroll
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label className="font-medium text-sm">Sidebar Style</Label>
            <ToggleGroup
              size="sm"
              spacing={0}
              variant="outline"
              type="single"
              className="w-full"
              value={variant}
              onValueChange={onSidebarStyleChange}
            >
              <ToggleGroupItem className="flex-1" value="inset" aria-label="Toggle inset">
                Inset
              </ToggleGroupItem>
              <ToggleGroupItem className="flex-1" value="sidebar" aria-label="Toggle sidebar">
                Sidebar
              </ToggleGroupItem>
              <ToggleGroupItem className="flex-1" value="floating" aria-label="Toggle floating">
                Floating
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label className="font-medium text-sm">Sidebar Collapse Mode</Label>
            <ToggleGroup
              size="sm"
              spacing={0}
              variant="outline"
              type="single"
              className="w-full"
              value={collapsible}
              onValueChange={onSidebarCollapseModeChange}
            >
              <ToggleGroupItem className="flex-1" value="icon" aria-label="Toggle icon">
                Icon
              </ToggleGroupItem>
              <ToggleGroupItem className="flex-1" value="offcanvas" aria-label="Toggle offcanvas">
                OffCanvas
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
