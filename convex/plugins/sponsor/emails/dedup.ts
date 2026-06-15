import type { Id } from "@/convex/_generated/dataModel"
import type { SponsorshipEmailType } from "@/convex/plugins/sponsor/lib/validators"
import { normalizeEmail } from "@/convex/plugins/sponsor/sanitize"

export function deriveDispatchDedupKey(input: {
  emailType: SponsorshipEmailType
  auctionId?: Id<"sponsorshipAuctions">
  sponsorId?: Id<"sponsors">
  email: string
  enqueueNonce?: string
  explicit?: string
}): string {
  if (input.explicit !== undefined && input.explicit.length > 0) {
    return input.explicit
  }
  const normalizedEmail = normalizeEmail(input.email)
  if (input.auctionId !== undefined) {
    const recipientKey = input.sponsorId ?? normalizedEmail
    return `${input.emailType}:${input.auctionId}:${recipientKey}`
  }
  return `${input.emailType}:${normalizedEmail}:${
    input.enqueueNonce ?? String(Date.now())
  }`
}
