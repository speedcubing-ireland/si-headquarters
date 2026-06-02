import { describe, expect, test } from "vitest"
import type { Infer } from "convex/values"
import type {
  COMPETITION_RESOURCE_TYPES,
  INTEGRATION_SERVICES,
  OAUTH_SERVICES,
  TASK_INTEGRATION_IDS,
  TASK_INTEGRATION_STATUSES,
} from "@/convex/plugins/core/constants"
import type {
  competitionResourceType,
  integrationService,
  oauthService,
  taskIntegrationId,
  taskIntegrationStatus,
} from "@/convex/plugins/core/validators"

type ExpectEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

type AssertEqual<A, B> = ExpectEqual<A, B> extends true ? true : never

describe("plugin constants and validators", () => {
  test("validators stay aligned with constants", () => {
    const resourceTypeCheck: AssertEqual<
      Infer<typeof competitionResourceType>,
      (typeof COMPETITION_RESOURCE_TYPES)[number]
    > = true
    const taskIntegrationIdCheck: AssertEqual<
      Infer<typeof taskIntegrationId>,
      (typeof TASK_INTEGRATION_IDS)[number]
    > = true
    const taskIntegrationStatusCheck: AssertEqual<
      Infer<typeof taskIntegrationStatus>,
      (typeof TASK_INTEGRATION_STATUSES)[number]
    > = true
    const integrationServiceCheck: AssertEqual<
      Infer<typeof integrationService>,
      (typeof INTEGRATION_SERVICES)[number]
    > = true
    const oauthServiceCheck: AssertEqual<
      Infer<typeof oauthService>,
      (typeof OAUTH_SERVICES)[number]
    > = true

    expect(resourceTypeCheck).toBe(true)
    expect(taskIntegrationIdCheck).toBe(true)
    expect(taskIntegrationStatusCheck).toBe(true)
    expect(integrationServiceCheck).toBe(true)
    expect(oauthServiceCheck).toBe(true)
  })
})
