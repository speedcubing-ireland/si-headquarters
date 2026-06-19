import type { SponsorshipEmailContext } from "@/convex/plugins/sponsor/lib/validators"

export interface EmailInfoRow {
  label: string
  value: string
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

export type EmailCopyContext = SponsorshipEmailContext & {
  recipientName?: string
  sponsorName?: string
}
