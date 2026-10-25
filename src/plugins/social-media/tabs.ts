import { type FeatureId, isFeatureEnabled } from "@/config/lib/organisation"

const ALL_TABS = [
  {
    id: "competitions",
    label: "Upcoming competitions",
    feature: "socialMedia",
  },
  { id: "records", label: "Records", feature: "records" },
] as const satisfies readonly {
  id: string
  label: string
  feature: FeatureId
}[]

export type SocialMediaTab = (typeof ALL_TABS)[number]["id"]

/** The tabs the organisation's features turn on, in display order. */
export const SOCIAL_MEDIA_TABS = ALL_TABS.filter((tab) =>
  isFeatureEnabled(tab.feature)
)

export function isSocialMediaTab(value: string): value is SocialMediaTab {
  return SOCIAL_MEDIA_TABS.some((tab) => tab.id === value)
}
