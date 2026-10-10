"use client";

import { createContext, useContext } from "react";

export interface AppFeatures {
  whatsapp: boolean;
  sms: boolean;
}

const DEFAULT_FEATURES: AppFeatures = { whatsapp: true, sms: true };

const FeatureContext = createContext<AppFeatures>(DEFAULT_FEATURES);

export function FeatureProvider({
  features,
  children,
}: {
  features: AppFeatures;
  children: React.ReactNode;
}) {
  return <FeatureContext.Provider value={features}>{children}</FeatureContext.Provider>;
}

/**
 * Read the developer-configured feature flags. Defaults to everything enabled
 * so components used outside the provider (or before config loads) keep working.
 */
export function useFeatures(): AppFeatures {
  return useContext(FeatureContext);
}
