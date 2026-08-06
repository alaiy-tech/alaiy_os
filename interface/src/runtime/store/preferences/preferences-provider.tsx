"use client";

import { createContext, use, useEffect, useState } from "react";

import { type StoreApi, useStore } from "zustand";

import type { PreferenceValueMap } from "@/lib/preferences/preferences-config";
import { applyThemeMode, subscribeToSystemTheme } from "@/lib/preferences/theme-utils";

import { createPreferencesStore, type PreferencesState } from "./preferences-store";

const PreferencesStoreContext = createContext<StoreApi<PreferencesState> | null>(null);

export function PreferencesStoreProvider({
  children,
  initialValues,
}: {
  children: React.ReactNode;
  initialValues: PreferenceValueMap;
}) {
  const [store] = useState<StoreApi<PreferencesState>>(() => createPreferencesStore(initialValues));

  useEffect(() => {
    // `initialValues` (the store's own creation-time state) is already
    // SQLite-sourced and correct - only `resolvedThemeMode` needs picking up
    // here, since ThemeBootScript resolved it (including "system") before
    // this ever ran.
    store.setState({
      resolvedThemeMode: document.documentElement.classList.contains("dark") ? "dark" : "light",
      isSynced: true,
    });
  }, [store]);

  useEffect(() => {
    let unsubscribeMedia: (() => void) | undefined;

    const subscribeForMode = (mode: PreferenceValueMap["theme_mode"]) => {
      unsubscribeMedia?.();
      unsubscribeMedia = undefined;

      if (mode === "system") {
        unsubscribeMedia = subscribeToSystemTheme(() => {
          store.setState({ resolvedThemeMode: applyThemeMode("system") });
        });
      }
    };

    subscribeForMode(store.getState().values.theme_mode);

    const unsubscribeStore = store.subscribe((state, previousState) => {
      if (state.values.theme_mode !== previousState.values.theme_mode) {
        subscribeForMode(state.values.theme_mode);
      }
    });

    return () => {
      unsubscribeMedia?.();
      unsubscribeStore();
    };
  }, [store]);

  return <PreferencesStoreContext.Provider value={store}>{children}</PreferencesStoreContext.Provider>;
}

export function usePreferencesStore<T>(selector: (state: PreferencesState) => T): T {
  const store = use(PreferencesStoreContext) as StoreApi<PreferencesState> | null;
  if (!store) throw new Error("Missing PreferencesStoreProvider");
  return useStore(store, selector);
}
