import { ConvexError } from "convex/values"
import { describe, expect, test } from "vitest"
import { unknownErrorMessage } from "@/convex/plugins/core/errorPayload"

describe("unknownErrorMessage", () => {
  test("reads message from ConvexError data when enabled", () => {
    expect(
      unknownErrorMessage(
        new ConvexError({
          code: "PRECONDITION_FAILED",
          message:
            "Link a Google Sheet to this competition before running this integration.",
        }),
        { includeConvexError: true }
      )
    ).toBe(
      "Link a Google Sheet to this competition before running this integration."
    )
  })

  test("reads message from JSON error strings", () => {
    expect(
      unknownErrorMessage(
        new Error(
          JSON.stringify({
            code: "PRECONDITION_FAILED",
            message:
              "Link a WCA competition to this competition before running this integration.",
          })
        )
      )
    ).toBe(
      "Link a WCA competition to this competition before running this integration."
    )
  })

  test("falls back to Error.message for plain errors", () => {
    expect(unknownErrorMessage(new Error("Something broke"))).toBe(
      "Something broke"
    )
  })
})
