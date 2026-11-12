import { describe, expect, test } from "vitest"
import { describeWcaErrorBody } from "@/convex/plugins/wca/wcifCompetition"

describe("describeWcaErrorBody", () => {
  test("uses the WCA's error field when present", () => {
    expect(
      describeWcaErrorBody(JSON.stringify({ error: "Invalid event id: fto" }))
    ).toBe("Invalid event id: fto")
  })

  test("falls back to the whole JSON body without an error field", () => {
    expect(describeWcaErrorBody(JSON.stringify({ message: "nope" }))).toBe(
      '{"message":"nope"}'
    )
  })

  test("does not throw on HTML or empty bodies", () => {
    expect(describeWcaErrorBody("<html><body>502</body></html>")).toBe(
      "the WCA returned an unexpected HTML page"
    )
    expect(describeWcaErrorBody("  ")).toBe("no details given")
  })

  test("keeps plain text and truncates long details", () => {
    expect(describeWcaErrorBody("Forbidden")).toBe("Forbidden")
    const detail = describeWcaErrorBody("x".repeat(600))
    expect(detail).toHaveLength(501)
    expect(detail.endsWith("…")).toBe(true)
  })
})
