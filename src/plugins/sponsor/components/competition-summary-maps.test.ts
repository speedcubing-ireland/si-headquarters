import { describe, expect, test } from "vitest"
import { buildGoogleMapsUrl } from "./competition-summary-maps"

describe("buildGoogleMapsUrl", () => {
  test("prefers coordinates when available", () => {
    expect(
      buildGoogleMapsUrl({
        address: "Dublin",
        latitude: 53.3498,
        longitude: -6.2603,
      })
    ).toBe("https://www.google.com/maps/search/?api=1&query=53.3498,-6.2603")
  })

  test("falls back to encoded address", () => {
    expect(
      buildGoogleMapsUrl({
        address: "Main Hall, Dublin, IE",
      })
    ).toBe(
      "https://www.google.com/maps/search/?api=1&query=Main%20Hall%2C%20Dublin%2C%20IE"
    )
  })

  test("returns null when there is no location data", () => {
    expect(buildGoogleMapsUrl({ address: "   " })).toBeNull()
  })
})
