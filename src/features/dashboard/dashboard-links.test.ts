import {
  DASHBOARD_ORIGIN,
  dashboardLinkHref,
  parseDashboardLinksResponse,
} from "@/features/dashboard/dashboard-links"
import { describe, expect, test } from "vitest"

const validResponse = JSON.stringify({
  links: [
    {
      id: "badges",
      title: "Badge Generator",
      description: "Generate badges",
      icon: "identity-card",
      href: "/badges",
      actionLabel: "Open Generator",
    },
  ],
})

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
})
