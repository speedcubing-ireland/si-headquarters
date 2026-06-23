import { describe, expect, test } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { AuctionCompetitionSummaryPanel } from "./competition-summary-panel"
import { formatDate, formatDateRange } from "@/lib/format/dates"
import { organisationConfig } from "@/config/lib/organisation"

const configuredDate = (iso: string) =>
  new Date(iso).toLocaleDateString(organisationConfig.regional.locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: organisationConfig.regional.timeZone,
  })

describe("formatDate", () => {
  test("formats a valid ISO date with the configured locale", () => {
    expect(formatDate("2026-01-31")).toBe(configuredDate("2026-01-31"))
  })

  test("does not fall back to slash-separated numeric dates", () => {
    const result = formatDate("2026-01-31")
    expect(result).not.toContain("1/31")
  })

  test("returns TBC for empty string", () => {
    expect(formatDate("")).toBe("TBC")
  })

  test("returns TBC for whitespace-only string", () => {
    expect(formatDate("   ")).toBe("TBC")
  })

  test("returns original string for an invalid date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date")
  })
})

describe("formatDateRange", () => {
  test("returns a single date when start equals end", () => {
    const result = formatDateRange("2026-01-31", "2026-01-31")
    expect(result).toBe(configuredDate("2026-01-31"))
    expect(result).not.toContain(" to ")
  })

  test("returns range string when start differs from end", () => {
    const result = formatDateRange("2026-01-31", "2026-02-01")
    expect(result).toContain(" to ")
    expect(result).not.toContain("/")
  })
})

describe("AuctionCompetitionSummaryPanel", () => {
  test("renders long event lists compactly without a disclosure row", () => {
    const html = renderToStaticMarkup(
      <AuctionCompetitionSummaryPanel
        source="wca"
        summary={{
          name: "Mayo Cubing 2026",
          address: "Foxford Sports & Leisure Centre",
          startDate: "2026-09-05",
          endDate: "2026-09-06",
          competitorLimit: 80,
          eventIds: [
            "333",
            "222",
            "444",
            "555",
            "666",
            "333bf",
            "333oh",
            "clock",
          ],
        }}
      />
    )

    expect(html).toContain("8 events")
    expect(html).not.toContain("Clock")
    expect(html).not.toContain("Show 2 more")
  })
})
