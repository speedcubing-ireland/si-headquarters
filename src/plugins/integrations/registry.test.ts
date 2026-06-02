import { describe, expect, test } from "vitest"
import { TASK_INTEGRATION_IDS } from "@/convex/plugins/core/constants"
import { INTEGRATION_PLUGINS } from "@/plugins/integrations/registry"

describe("frontend integration registry", () => {
  test("has a task card for every task integration id", () => {
    const cardIds = new Set(
      INTEGRATION_PLUGINS.flatMap((plugin) =>
        Object.keys(plugin.taskIntegrationCards)
      )
    )

    expect([...cardIds].sort()).toEqual([...TASK_INTEGRATION_IDS].sort())
  })

  test("declares plugin icons for add/link pickers", () => {
    expect(INTEGRATION_PLUGINS.map((plugin) => plugin.id).sort()).toEqual([
      "canva",
      "discord",
      "sheets",
      "wca",
    ])
    expect(INTEGRATION_PLUGINS.every((plugin) => plugin.adminIcon !== undefined))
      .toBe(true)
  })
})

