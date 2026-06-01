/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string
  readonly VITE_CONVEX_SITE_URL?: string
  readonly VITE_SPONSORSHIP_ENABLED?: string
  readonly VITE_SPONSOR_SITE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
