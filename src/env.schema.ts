import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

const booleanFlag = z
  .preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z
      .union([
        z.literal("1"),
        z.literal("true"),
        z.literal("yes"),
        z.literal("0"),
        z.literal("false"),
        z.literal("no"),
      ])
      .default("false")
  )
  .transform((value) => value === "1" || value === "true" || value === "yes")

export interface ClientRuntimeEnv {
  readonly VITE_CONVEX_URL: string | undefined
  readonly VITE_CONVEX_SITE_URL: string | undefined
  readonly VITE_SPONSOR_SITE: string | undefined
  readonly VITE_GIT_SHA: string | undefined
}

export function createClientEnv(runtimeEnv: ClientRuntimeEnv) {
  return createEnv({
    clientPrefix: "VITE_",
    client: {
      VITE_CONVEX_URL: z.url(),
      VITE_CONVEX_SITE_URL: z.url(),
      VITE_SPONSOR_SITE: booleanFlag,
      // Commit SHA set by the deploy workflow at build time, shown in the sidebar footer.
      VITE_GIT_SHA: z.string().min(1).optional(),
    },
    runtimeEnvStrict: {
      VITE_CONVEX_URL: runtimeEnv.VITE_CONVEX_URL,
      VITE_CONVEX_SITE_URL: runtimeEnv.VITE_CONVEX_SITE_URL,
      VITE_SPONSOR_SITE: runtimeEnv.VITE_SPONSOR_SITE,
      VITE_GIT_SHA: runtimeEnv.VITE_GIT_SHA,
    },
    emptyStringAsUndefined: true,
  })
}
