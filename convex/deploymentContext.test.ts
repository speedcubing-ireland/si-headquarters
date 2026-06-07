import { describe, expect, test } from "vitest"
import {
  resolveDeploymentContext,
  resolveWcaApiBaseUrl,
  resolveWcaBaseUrl,
} from "@/convex/deploymentContext"

describe("deployment context", () => {
  test("resolves production WCA URLs", () => {
    const source = { DEPLOYMENT_CONTEXT: "production" }

    expect(resolveDeploymentContext(source)).toBe("production")
    expect(resolveWcaBaseUrl(source)).toBe(
      "https://www.worldcubeassociation.org"
    )
    expect(resolveWcaApiBaseUrl(source)).toBe(
      "https://www.worldcubeassociation.org/api"
    )
  })

  test("resolves staging WCA URLs", () => {
    const source = { DEPLOYMENT_CONTEXT: "staging" }

    expect(resolveDeploymentContext(source)).toBe("staging")
    expect(resolveWcaBaseUrl(source)).toBe(
      "https://staging.worldcubeassociation.org"
    )
    expect(resolveWcaApiBaseUrl(source)).toBe(
      "https://staging.worldcubeassociation.org/api"
    )
  })

  test("throws when deployment context is missing", () => {
    expect(() => resolveDeploymentContext({})).toThrow(
      "DEPLOYMENT_CONTEXT must be set"
    )
  })

  test("throws when deployment context is invalid", () => {
    expect(() =>
      resolveDeploymentContext({ DEPLOYMENT_CONTEXT: "preview" })
    ).toThrow("DEPLOYMENT_CONTEXT must be set")
  })
})
