import { createClientEnv } from "@/env.schema"

export { createClientEnv, type ClientRuntimeEnv } from "@/env.schema"

export const env = createClientEnv({
  VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL,
  VITE_CONVEX_SITE_URL: import.meta.env.VITE_CONVEX_SITE_URL,
  VITE_SPONSOR_SITE: import.meta.env.VITE_SPONSOR_SITE,
})
