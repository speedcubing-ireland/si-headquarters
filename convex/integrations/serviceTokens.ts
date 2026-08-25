import { v, type Infer } from "convex/values"

export const serviceToken = v.object({
  accessToken: v.string(),
  refreshToken: v.string(),
  expiresAt: v.number(),
  scope: v.optional(v.string()),
})

export type ServiceToken = Infer<typeof serviceToken>

export function serviceTokensEqual(
  left: ServiceToken,
  right: ServiceToken
): boolean {
  return (
    left.accessToken === right.accessToken &&
    left.refreshToken === right.refreshToken &&
    left.expiresAt === right.expiresAt
  )
}
