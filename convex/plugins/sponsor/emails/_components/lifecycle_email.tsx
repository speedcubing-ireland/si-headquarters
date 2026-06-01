import type {
  SponsorshipEmailContext,
  SponsorshipLifecycleEmailType,
} from "@/convex/plugins/sponsor/lib/validators"
import { sponsorshipEmailTemplateCopy } from "../copy"
import { SponsorshipEmailShell } from "../_design"
import { SponsorshipEmailBody } from "./sponsorship_email_body"

export interface LifecycleEmailProps extends SponsorshipEmailContext {
  variant: SponsorshipLifecycleEmailType
  competitionName: string
  portalUrl: string
  recipientName?: string
}

export function LifecycleEmail(props: LifecycleEmailProps) {
  const copy = sponsorshipEmailTemplateCopy(props.variant, props)

  return (
    <SponsorshipEmailShell
      preview={copy.preview}
      title={copy.title}
      subtitle={copy.subtitle}
      ctaLabel={copy.ctaLabel}
      ctaUrl={props.portalUrl}
    >
      <SponsorshipEmailBody copy={copy} />
    </SponsorshipEmailShell>
  )
}
