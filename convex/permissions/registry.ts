import type { PermissionKey } from "./authorize"

export type PermissionGrantStrategy = "team-membership" | "custom"

export interface PermissionDefinition {
  key: PermissionKey
  description: string
  grantedVia: PermissionGrantStrategy
}

/**
 * Registry of permission keys and how they are granted today.
 * Replace team-membership checks with a richer policy engine here later.
 */
export const PERMISSION_REGISTRY = {
  sponsorshipManager: {
    key: "sponsorshipManager",
    description:
      "Manage sponsorship sponsors, auctions, and competition property status.",
    grantedVia: "team-membership",
  },
} as const satisfies Record<PermissionKey, PermissionDefinition>
