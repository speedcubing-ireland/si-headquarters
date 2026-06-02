import { describe, expect, test } from "vitest"
import { TASK_INTEGRATION_IDS } from "@/convex/plugins/core/constants"
import { INTEGRATION_PLUGINS } from "@/convex/plugins/registry"

describe("backend integration registry", () => {
  test("registers every task integration id from constants", () => {
    const registeredIds = new Set(
      INTEGRATION_PLUGINS.flatMap(
        (plugin) => plugin.taskIntegrations?.map((ti) => ti.id) ?? []
      )
    )

    expect([...registeredIds].sort()).toEqual([...TASK_INTEGRATION_IDS].sort())
  })
})
