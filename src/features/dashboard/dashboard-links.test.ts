import {
  DASHBOARD_ORIGIN,
  dashboardLinkHref,
  parseDashboardLinksResponse,
} from "@/features/dashboard/dashboard-links"
import { describe, expect, test } from "vitest"

const validLink = {
  id: "badges",
  title: "Badge Generator",
  description: "Generate badges",
  icon: "identity-card",
  href: "/badges",
  actionLabel: "Open Generator",
}
const validResponse = JSON.stringify({ links: [validLink] })

describe("dashboard links", () => {
  test("parses the public catalogue and builds an absolute link", () => {
    const [link] = parseDashboardLinksResponse(validResponse)

    expect(link).toBeDefined()
    expect(dashboardLinkHref(link)).toBe(`${DASHBOARD_ORIGIN}/badges`)
  })

  test("rejects catalogue entries with an unsupported icon", () => {
    expect(() =>
      parseDashboardLinksResponse(
        validResponse.replace("identity-card", "other")
      )
    ).toThrow()
  })

  test("rejects duplicate ids and links outside the dashboard origin", () => {
    expect(() =>
      parseDashboardLinksResponse(
        JSON.stringify({ links: [validLink, validLink] })
      )
    ).toThrow(/unique/)
    expect(() =>
      parseDashboardLinksResponse(
        validResponse.replace('"/badges"', '"https://attacker.example"')
      )
    ).toThrow()
  })
})
