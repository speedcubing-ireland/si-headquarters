import { describe, expect, test } from "vitest"
import {
  TASK_INTEGRATION_DEFINITIONS,
  TASK_INTEGRATION_IDS,
} from "@/convex/plugins/core/constants"
import { buildTaskIntegrationDefinitions } from "@/convex/plugins/core/integrationTypes"
import { INTEGRATION_PLUGINS } from "@/convex/plugins/registry"

describe("backend integration registry", () => {
  test("registers every task integration id from constants", () => {
    const registeredIds = INTEGRATION_PLUGINS.flatMap((plugin) =>
      buildTaskIntegrationDefinitions(plugin).map((ti) => ti.id)
    )

    expect([...new Set(registeredIds)].sort()).toEqual(
      [...TASK_INTEGRATION_IDS].sort()
    )
    expect(registeredIds).toHaveLength(TASK_INTEGRATION_IDS.length)
  })

  test("joins runner overlays with catalog metadata", () => {
    const definitions = INTEGRATION_PLUGINS.flatMap((plugin) =>
      buildTaskIntegrationDefinitions(plugin)
    )

    for (const definition of definitions) {
      expect(definition).toMatchObject({
        label: TASK_INTEGRATION_DEFINITIONS[definition.id].label,
        pluginId: TASK_INTEGRATION_DEFINITIONS[definition.id].pluginId,
        requiredResources:
          TASK_INTEGRATION_DEFINITIONS[definition.id].requiredResources,
      })
    }
  })
})
