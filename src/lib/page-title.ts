import { organisationConfig } from "@/config/lib/organisation"

const PRODUCT_TITLE_SUFFIX = `${organisationConfig.organisation.productName} | ${organisationConfig.organisation.name}`

export function productPageTitle(pageName: string): string {
  return `${pageName} | ${PRODUCT_TITLE_SUFFIX}`
}

/**
 * Pages whose title is decided by the path alone. Values are optional because
 * the lookup is by arbitrary pathname, and this project does not run with
 * `noUncheckedIndexedAccess`, so a plain `Record` would claim a hit for every
 * path.
 */
const PAGE_NAMES: Readonly<Record<string, string | undefined>> = {
  "/tasks": "Tasks",
  "/help": "Help",
  "/events": "Events",
  "/dashboard": "Dashboard",
}

export function getPageTitle(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/"
  if (normalized === "/sponsor" || normalized.startsWith("/sponsor/")) {
    return `Sponsors | ${organisationConfig.organisation.name}`
  }
  const pageName = PAGE_NAMES[normalized]
  if (pageName !== undefined) {
    return productPageTitle(pageName)
  }
  if (/^\/teams\/[^/]+\/tasks$/.test(normalized)) {
    return productPageTitle("Team Tasks")
  }
  return PRODUCT_TITLE_SUFFIX
}
