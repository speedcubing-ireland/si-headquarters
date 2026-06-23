import { ConvexError } from "convex/values"
import { isFeatureEnabled } from "@/config/lib/organisation"

export function assertWcaIntegrationEnabled(): void {
  if (!isFeatureEnabled("wcaIntegration")) {
    throw new ConvexError({
      code: "PRECONDITION_FAILED",
      message: "WCA integration is not enabled for this organisation.",
    })
  }
}
