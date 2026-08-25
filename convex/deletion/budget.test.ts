import {
  createDeletionBudget,
  MAX_DELETION_WRITES,
  reserveDeletionWork,
} from "@/convex/deletion/budget"
import { describe, expect, test } from "vitest"

describe("deletion budget", () => {
  test("rejects aggregate work beyond the safe transaction envelope", () => {
    const budget = createDeletionBudget()
    reserveDeletionWork(budget, {
      reason: "first domain",
      writes: MAX_DELETION_WRITES,
    })

    expect(() => {
      reserveDeletionWork(budget, { reason: "second domain", writes: 1 })
    }).toThrow("Deletion is too large to run safely")
  })
})
