import { describe, expect, test, vi } from "vitest"
import type { TaskIntegrationId } from "@/convex/integrations/taskIntegrations/validators"
import { resolveTaskSpecIntegrationIds } from "@/convex/integrations/taskIntegrations/templates"

// Validate ids against the full catalog with every feature enabled.
vi.mock(
  "@/config/lib/organisation",
  () => import("@/config/lib/organisation.testFixture")
)

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
