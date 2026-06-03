export {
  buildSponsorshipEmailHtml,
  buildSponsorshipEmailPlainText,
  buildSponsorPortalOtpEmail,
} from "./render"
export type { SponsorshipEmailContext } from "@/convex/plugins/sponsor/lib/validators"
export {
  getSponsorshipEmailPayload,
  sponsorshipEmailMessageFallback,
  sponsorshipEmailSubject,
  sponsorshipEmailTemplateCopy,
} from "./copy"
export type { EmailCopyContext, EmailTemplateCopy } from "./types"
export { scheduleSponsorshipEmailBatch } from "./send"
export type {
  ScheduleSponsorshipEmailBatchArgs,
  SponsorshipEmailRecipient,
} from "./send"
