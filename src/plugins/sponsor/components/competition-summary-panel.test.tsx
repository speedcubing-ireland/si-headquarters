import { describe, expect, test } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { AuctionCompetitionSummaryPanel } from "./competition-summary-panel"

describe("AuctionCompetitionSummaryPanel", () => {
  test("renders custom offering markdown without competition detail placeholders", () => {
    const html = renderToStaticMarkup(
      <AuctionCompetitionSummaryPanel
        source="custom"
        offeringDescriptionMarkdown="**Gold package**\n\nIncludes logo placement."
        summary={{
          name: "Gold sponsor package",
          address: "",
          startDate: "2026-09-05",
          endDate: "2026-09-06",
          eventIds: [],
        }}
      />
    )

    expect(html).toContain("More info")
    expect(html).toContain("Gold package")
    expect(html).toContain("Includes logo placement.")
    expect(html).not.toContain("Competition details")
    expect(html).not.toContain("Events not listed")
    expect(html).not.toContain("No competitor limit listed")
  })

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
