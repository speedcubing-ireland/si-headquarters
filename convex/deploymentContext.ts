import { env } from "@/convex/_generated/server"

export const DEPLOYMENT_CONTEXT_ENV = "DEPLOYMENT_CONTEXT" as const

export type DeploymentContext = "staging" | "production"

export interface DeploymentContextEnvSource {
  readonly [DEPLOYMENT_CONTEXT_ENV]?: string
}

const WCA_BASE_URL_BY_CONTEXT = {
  staging: "https://staging.worldcubeassociation.org",
  production: "https://www.worldcubeassociation.org",
} as const satisfies Record<DeploymentContext, string>

export function resolveDeploymentContext(
  source: DeploymentContextEnvSource = env
): DeploymentContext {
  const value = source[DEPLOYMENT_CONTEXT_ENV]
  if (value === "staging" || value === "production") {
    return value
  }
  throw new Error(
    `${DEPLOYMENT_CONTEXT_ENV} must be set to either 'staging' or 'production'.`
  )
}

export function resolveWcaBaseUrl(source?: DeploymentContextEnvSource): string {
  return WCA_BASE_URL_BY_CONTEXT[resolveDeploymentContext(source)]
}

export function resolveWcaApiBaseUrl(
  source?: DeploymentContextEnvSource
): string {
  return `${resolveWcaBaseUrl(source)}/api`
}
