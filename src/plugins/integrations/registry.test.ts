import { describe, expect, test, vi } from "vitest"
import {
  TASK_INTEGRATION_DEFINITIONS,
  TASK_INTEGRATION_IDS,
} from "@/convex/integrations/taskIntegrations/constants"
import {
  INTEGRATION_PLUGINS,
  TASK_INTEGRATION_CARDS,
} from "@/plugins/integrations/registry"

// Verify the full catalog wiring with every feature enabled, independent of
// which features the shipped manifest gates on.
vi.mock(
  "@/config/lib/organisation",
  () => import("@/config/lib/organisation.testFixture")
)

describe("frontend integration registry", () => {
  test("has a task card for every task integration id", () => {
    expect([...TASK_INTEGRATION_CARDS.keys()].sort()).toEqual(
      [...TASK_INTEGRATION_IDS].sort()
    )
    expect(TASK_INTEGRATION_CARDS.size).toBe(TASK_INTEGRATION_IDS.length)
  })

  test("declares task ids matching catalog plugin ownership", () => {
    for (const plugin of INTEGRATION_PLUGINS) {
      const expectedIds = Object.entries(TASK_INTEGRATION_DEFINITIONS)
        .filter(([, definition]) => definition.pluginId === plugin.id)
        .map(([id]) => id)
        .sort()
      const registeredIds = [...(plugin.taskIntegrationIds ?? [])].sort()

      expect(registeredIds).toEqual(expectedIds)
    }
  })

  test("has no duplicate task card registrations", () => {
    const cardIds = INTEGRATION_PLUGINS.flatMap(
      (plugin) => plugin.taskIntegrationIds ?? []
    )
    expect(cardIds).toHaveLength(new Set(cardIds).size)
  })

  test("declares plugin icons for add/link pickers", () => {
    expect(INTEGRATION_PLUGINS.map((plugin) => plugin.id).sort()).toEqual([
      "canva",
      "discord",
      "sheets",
      "wca",
    ])
    expect(
      INTEGRATION_PLUGINS.every((plugin) => plugin.adminIcon !== undefined)
    ).toBe(true)
  })
})
