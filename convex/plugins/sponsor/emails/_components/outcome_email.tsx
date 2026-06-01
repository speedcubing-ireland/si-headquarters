import { Section, Text } from "@react-email/components"
import type {
  SponsorshipEmailContext,
  SponsorshipOutcomeEmailType,
} from "@/convex/plugins/sponsor/lib/validators"
import { sponsorshipEmailTemplateCopy } from "../copy"
import { SponsorshipEmailShell } from "../_design"
import { SponsorshipInfoStack } from "./info_stack"

export interface OutcomeEmailProps extends SponsorshipEmailContext {
  variant: SponsorshipOutcomeEmailType
  competitionName: string
  portalUrl: string
  recipientName?: string
}

const footnoteTextClass = "m-0 mt-3 text-xs leading-5 text-brand-muted"

export function OutcomeEmail(props: OutcomeEmailProps) {
  const copy = sponsorshipEmailTemplateCopy(props.variant, props)

  return (
    <SponsorshipEmailShell
      preview={copy.preview}
      title={copy.title}
      subtitle={copy.subtitle}
      ctaLabel={copy.ctaLabel}
      ctaUrl={props.portalUrl}
    >
      <Section>
        <SponsorshipInfoStack rows={copy.infoRows} />
        {copy.footnoteParagraphs.map((paragraph) => (
          <Text key={paragraph} className={footnoteTextClass}>
            {paragraph}
          </Text>
        ))}
      </Section>
    </SponsorshipEmailShell>
  )
}
