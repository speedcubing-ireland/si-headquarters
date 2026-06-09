import type { Infer } from "convex/values"
import { describe, expect, test } from "vitest"
import { DEFAULT_RESOURCE_KEYS } from "@/convex/integrations/constants"
import type {
  LINKED_RESOURCE_TYPES,
  INTEGRATION_SERVICES,
  OAUTH_SERVICES,
} from "@/convex/integrations/constants"
import { MANUAL_TASK_INTEGRATION_STATUSES } from "@/convex/integrations/taskIntegrations/constants"
import type {
  TASK_INTEGRATION_IDS,
  TASK_INTEGRATION_STATUSES,
} from "@/convex/integrations/taskIntegrations/constants"
import type {
  linkedResourceType,
  integrationService,
  oauthService,
} from "@/convex/integrations/validators"
import type {
  manualTaskIntegrationStatus,
  taskIntegrationId,
  taskIntegrationStatus,
} from "@/convex/integrations/taskIntegrations/validators"

type ExpectEqual<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false
type AssertEqual<A, B> = ExpectEqual<A, B> extends true ? true : never

describe("plugin constants and validators", () => {
  test("validators stay aligned with constants", () => {
    const resourceTypeCheck: AssertEqual<
      Infer<typeof linkedResourceType>,
      (typeof LINKED_RESOURCE_TYPES)[number]
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
    const manualStatusCheck: AssertEqual<
      Infer<typeof manualTaskIntegrationStatus>,
      (typeof MANUAL_TASK_INTEGRATION_STATUSES)[number]
    > = true

    expect(resourceTypeCheck).toBe(true)
    expect(taskIntegrationIdCheck).toBe(true)
    expect(taskIntegrationStatusCheck).toBe(true)
    expect(integrationServiceCheck).toBe(true)
    expect(oauthServiceCheck).toBe(true)
    expect(manualStatusCheck).toBe(true)
  })

  test("keeps explicit manual statuses and default resource keys", () => {
    expect(MANUAL_TASK_INTEGRATION_STATUSES).toEqual([
      "awaiting_manual_share",
      "awaiting_manual_events_confirmation",
    ])
    expect(DEFAULT_RESOURCE_KEYS).toEqual({
      googleSheet: "default",
      wcaCompetition: "default",
      discordChannel: "default",
    })
  })
})
