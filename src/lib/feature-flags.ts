import { parseTruthyFlag } from "@/lib/env-flags"

function readViteEnvFlag(
  name: keyof Pick<ImportMetaEnv, "VITE_SPONSORSHIP_ENABLED">,
): string | undefined {
  return import.meta.env[name]
}

export const isSponsorshipEnabled = parseTruthyFlag(
  readViteEnvFlag("VITE_SPONSORSHIP_ENABLED"),
)
