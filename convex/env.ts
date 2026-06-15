import { v } from "convex/values"
import { REQUIRED_ENV_KEYS } from "@/convex/envConfig"

function requiredStrings(keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, v.string()]))
}

export const convexEnv = {
  ...requiredStrings(REQUIRED_ENV_KEYS),
  DEPLOYMENT_CONTEXT: v.union(v.literal("staging"), v.literal("production")),
  AUTH_WCA_ID: v.optional(v.string()),
  AUTH_WCA_SECRET: v.optional(v.string()),
  RESEND_TEST_MODE: v.union(v.literal("true"), v.literal("false")),
  BETTER_AUTH_SECRET: v.optional(v.string()),
  VITE_SITE_URL: v.optional(v.string()),
  CORS_ALLOWED_ORIGINS: v.optional(v.string()),
}
