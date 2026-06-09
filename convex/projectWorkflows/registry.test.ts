import { describe, expect, test } from "vitest"
import { PROJECT_WORKFLOW_IDS } from "@/convex/projectWorkflows/constants"
import {
  listProjectWorkflowDefinitions,
  toProjectWorkflowDefinitionMeta,
} from "@/convex/projectWorkflows/registry"

describe("project workflow registry", () => {
  test("registers every declared project workflow id once", () => {
    const definitions = listProjectWorkflowDefinitions()
    const ids = definitions.map((definition) => definition.id)

    expect([...new Set(ids)].sort()).toEqual([...PROJECT_WORKFLOW_IDS].sort())
    expect(ids).toHaveLength(PROJECT_WORKFLOW_IDS.length)
  })

  test("keeps plugin ownership and metadata on the public definition shape", () => {
    const definitions = listProjectWorkflowDefinitions()

    expect(definitions.map(toProjectWorkflowDefinitionMeta)).toEqual([
      {
        id: "certificates.ordering",
        pluginId: "certificates",
        label: "Certificate ordering",
        description:
          "Find certificate-labelled project tasks that need ordering attention before their due dates.",
        defaultConfig: {
          kind: "certificates.ordering",
          leadTimeDays: 18,
        },
        schedule: { kind: "daily" },
      },
    ])
  })
})
