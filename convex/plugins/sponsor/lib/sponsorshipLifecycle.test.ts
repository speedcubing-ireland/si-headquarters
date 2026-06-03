import { describe, expect, test } from "vitest"
import { resolveSponsorshipLifecycle } from "./sponsorshipLifecycle"

describe("resolveSponsorshipLifecycle", () => {
  test("returns upcoming before the event starts", () => {
    expect(
      resolveSponsorshipLifecycle({
        startDate: "2026-09-05",
        endDate: "2026-09-06",
        now: new Date(2026, 8, 1).getTime(),
      })
    ).toBe("upcoming")
  })

  test("returns ongoing during the event window", () => {
    expect(
      resolveSponsorshipLifecycle({
        startDate: "2026-09-05",
        endDate: "2026-09-06",
        now: new Date(2026, 8, 5, 12).getTime(),
      })
    ).toBe("ongoing")
  })

  test("returns completed after the event ends", () => {
    expect(
      resolveSponsorshipLifecycle({
        startDate: "2026-09-05",
        endDate: "2026-09-06",
        now: new Date(2026, 8, 7).getTime(),
      })
    ).toBe("completed")
  })
})
