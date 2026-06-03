import type { SponsorshipEmailContext } from "@/convex/plugins/sponsor/lib/validators"

export interface EmailInfoRow {
  label: string
  value: string
  /** When set, the value is shown as a link in HTML emails (“Read more”). */
  valueHref?: string
}

export interface EmailTemplateCopy {
  preview: string
  title: string
  subtitle: string
  ctaLabel: string
  infoRows: EmailInfoRow[]
  bodyParagraphs: string[]
  footnoteParagraphs: string[]
  showAntiSnipingNote: boolean
}

/** Copy + template props shared across sponsorship emails. */
export type EmailCopyContext = SponsorshipEmailContext & {
  recipientName?: string
  sponsorName?: string
}
