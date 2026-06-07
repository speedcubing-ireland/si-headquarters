import { createApi } from "@convex-dev/better-auth"
import type { BetterAuthOptions } from "better-auth/minimal"
import schema from "@/convex/plugins/sponsor/auth/component/sponsorAuth/schema"

function createTestSponsorAuthOptions(): BetterAuthOptions {
  return {}
}

export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, createTestSponsorAuthOptions)
