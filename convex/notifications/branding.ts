import { organisationConfig } from "@/config/lib/organisation"
import { mainSiteUrl } from "@/convex/urls"

export function notificationFooterText(): string {
  return organisationConfig.branding.notificationFooterText
}

export function notificationIconUrl(): string {
  return mainSiteUrl(organisationConfig.branding.faviconPath)
}
