import type { EnvServiceManifest } from "@/convex/envConfig"

export const SOCIAL_MEDIA_RECORDS_EMAIL_TO_ENV =
  "SOCIAL_MEDIA_RECORDS_EMAIL_TO" as const
export const SOCIAL_MEDIA_EMAIL_SENDER_ADDRESS_ENV =
  "SOCIAL_MEDIA_EMAIL_SENDER_ADDRESS" as const

// Kept in Convex env rather than the organisation config so the team can change
// who receives the weekly records email without a deploy. Both are optional:
// with either unset the weekly run is recorded as skipped instead of failing.
export const SOCIAL_MEDIA_RECORDS_DEFINITION = {
  env: [
    SOCIAL_MEDIA_RECORDS_EMAIL_TO_ENV,
    SOCIAL_MEDIA_EMAIL_SENDER_ADDRESS_ENV,
  ] as const,
  setup: [
    {
      key: SOCIAL_MEDIA_RECORDS_EMAIL_TO_ENV,
      group: "Email",
      kind: "prompt",
      description:
        "Comma-separated recipients of the Monday Irish records email. Leave blank to skip sending it.",
      optional: true,
    },
    {
      key: SOCIAL_MEDIA_EMAIL_SENDER_ADDRESS_ENV,
      group: "Email",
      kind: "prompt",
      description:
        'From address for the Monday records email, e.g. "SI Headquarters <noreply@speedcubingireland.com>".',
      optional: true,
    },
  ],
} as const satisfies EnvServiceManifest
