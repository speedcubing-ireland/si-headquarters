import { organisationConfig } from "@/config/lib/organisation"

const PRODUCT_TITLE_SUFFIX = `${organisationConfig.organisation.productName} | ${organisationConfig.organisation.name}`

export function productPageTitle(pageName: string): string {
  return `${pageName} | ${PRODUCT_TITLE_SUFFIX}`
}

export function getPageTitle(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/"
  if (normalized === "/sponsor" || normalized.startsWith("/sponsor/")) {
    return `Sponsors | ${organisationConfig.organisation.name}`
  }
  if (normalized === "/tasks") {
    return productPageTitle("Tasks")
  }
  if (normalized === "/events") {
    return productPageTitle("Events")
  }
  if (normalized === "/dashboard") {
    return productPageTitle("Dashboard")
  }
  const teamTasksMatch = /^\/teams\/[^/]+\/tasks$/.exec(normalized)
  if (teamTasksMatch !== null) {
    return productPageTitle("Team Tasks")
  }
  return PRODUCT_TITLE_SUFFIX
}
