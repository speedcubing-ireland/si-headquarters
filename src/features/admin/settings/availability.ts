import { isFeatureEnabled } from "@/config/lib/organisation"

/** Whether any feature with a card on Admin → Settings is enabled. */
export function hasAdminSettings(): boolean {
  return (
    isFeatureEnabled("canva") ||
    isFeatureEnabled("records") ||
    isFeatureEnabled("sponsors") ||
    isFeatureEnabled("wcaIntegration")
  )
}
