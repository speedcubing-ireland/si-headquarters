import type { BackendIntegrationPlugin } from "@/convex/plugins/core/integrationTypes"

export const WCA_2FA_SECRET_ENV = "WCA_2FA_SECRET" as const

export const wcaPlugin = {
  id: "wca",
  service: "wca",
  env: [WCA_2FA_SECRET_ENV],
} satisfies BackendIntegrationPlugin
