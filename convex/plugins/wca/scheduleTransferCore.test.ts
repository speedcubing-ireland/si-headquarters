import { describe, expect, test } from "vitest"
import { rejectedWcifUploadError } from "@/convex/plugins/wca/scheduleTransferCore"

function event(id: string) {
  return { id, rounds: [], extensions: [] }
}

const validationRejection = { status: 400, error: "WCA rejected it." }

describe("rejectedWcifUploadError", () => {
  test("names unverified events newly sent in a rejected upload", () => {
    const error = rejectedWcifUploadError(
      validationRejection,
      [event("333"), event("fto")],
      [event("333")]
    )
    expect(error).toMatch(/^WCA rejected it\. /)
    expect(error).toContain("(Face-Turning Octahedron)")
  })

  test("keeps the WCA's error alone when only established events were sent", () => {
    expect(
      rejectedWcifUploadError(
        validationRejection,
        [event("333"), event("333mbf")],
        []
      )
    ).toBe("WCA rejected it.")
  })

  test("does not suspect events the competition already has", () => {
    expect(
      rejectedWcifUploadError(
        validationRejection,
        [event("fto")],
        [event("fto")]
      )
    ).toBe("WCA rejected it.")
  })

  test.each([401, 403, 500, 502])(
    "does not blame events for an HTTP %i failure",
    (status) => {
      expect(
        rejectedWcifUploadError(
          { status, error: "WCA rejected it." },
          [event("fto")],
          []
        )
      ).toBe("WCA rejected it.")
    }
  )
})
