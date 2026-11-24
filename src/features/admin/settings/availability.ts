import type { FeatureId } from "@/config/lib/organisation"
import { isFeatureEnabled } from "@/config/lib/organisation"

/** The features with a card on Admin → Settings, in the order they appear. */
export const ADMIN_SETTINGS_FEATURES = [
  "canva",
  "records",
  "sponsors",
  "wcaIntegration",
] as const satisfies readonly FeatureId[]

export type AdminSettingsFeature = (typeof ADMIN_SETTINGS_FEATURES)[number]

/** The Admin → Settings cards this deployment shows, in order. */
export function enabledAdminSettingsFeatures(): AdminSettingsFeature[] {
  return ADMIN_SETTINGS_FEATURES.filter((feature) => isFeatureEnabled(feature))
}

/** Whether any feature with a card on Admin → Settings is enabled. */
export function hasAdminSettings(): boolean {
  return enabledAdminSettingsFeatures().length > 0
}
