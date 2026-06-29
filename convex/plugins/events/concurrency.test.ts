import { describe, expect, test } from "vitest"
import { mapWithConcurrency } from "@/convex/plugins/events/concurrency"

describe("mapWithConcurrency", () => {
  test("preserves result order while bounding active work", async () => {
    let active = 0
    let maximumActive = 0
    const results = await mapWithConcurrency(
      [1, 2, 3, 4, 5],
      2,
      async (value) => {
        active += 1
        maximumActive = Math.max(maximumActive, active)
        await Promise.resolve()
        active -= 1
        return value * 2
      }
    )

    expect(results).toEqual([2, 4, 6, 8, 10])
    expect(maximumActive).toBe(2)
  })

  test("rejects invalid concurrency", async () => {
    await expect(
      mapWithConcurrency([1], 0, async (value) => value)
    ).rejects.toThrow(/positive integer/)
  })
})
