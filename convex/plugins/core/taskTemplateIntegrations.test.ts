import { describe, expect, test } from "vitest"
import type { TaskIntegrationId } from "@/convex/plugins/core/validators"
import { resolveTaskSpecIntegrationIds } from "@/convex/plugins/core/taskTemplateIntegrations"

describe("resolveTaskSpecIntegrationIds", () => {
  test("returns empty list when integrationIds is omitted", () => {
    expect(resolveTaskSpecIntegrationIds({})).toEqual([])
  })

  test("returns validated integration ids", () => {
    expect(
      resolveTaskSpecIntegrationIds({
        integrationIds: ["canva.certificates", "sheet.populate-checkin"],
      })
    ).toEqual(["canva.certificates", "sheet.populate-checkin"])
  })

  test("throws for unknown integration ids", () => {
    expect(() =>
      resolveTaskSpecIntegrationIds({
        integrationIds: ["unknown.integration" as TaskIntegrationId],
      })
    ).toThrow(/Unknown task integration id/)
  })
})

