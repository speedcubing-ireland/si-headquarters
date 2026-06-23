import { describe, expect, it } from "vitest"
import { getPageTitle, productPageTitle } from "./page-title"
import { organisationConfig } from "@/config/lib/organisation"

const PRODUCT_TITLE = `${organisationConfig.organisation.productName} | ${organisationConfig.organisation.name}`
const SPONSOR_TITLE = `Sponsors | ${organisationConfig.organisation.name}`

describe("getPageTitle", () => {
  it.each([
    ["/", PRODUCT_TITLE],
    ["/tasks", productPageTitle("Tasks")],
    ["/teams/abc123/tasks", productPageTitle("Team Tasks")],
    ["/competitions", PRODUCT_TITLE],
    ["/plugins/sponsorship", PRODUCT_TITLE],
    ["/sponsors", PRODUCT_TITLE],
    ["/sponsor", SPONSOR_TITLE],
    ["/sponsor/", SPONSOR_TITLE],
    ["/sponsor/login", SPONSOR_TITLE],
    ["/sponsor/auctions/123", SPONSOR_TITLE],
    ["/sponsor/settings", SPONSOR_TITLE],
  ])("%s → %s", (pathname, expected) => {
    expect(getPageTitle(pathname)).toBe(expected)
  })
})
