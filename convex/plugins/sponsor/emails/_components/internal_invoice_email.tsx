import { Hr, Section, Text } from "@react-email/components"
import type { SponsorshipEmailContext } from "@/convex/plugins/sponsor/lib/validators"
import {
  INTERNAL_INVOICE_NEXT_STEPS,
  sponsorshipEmailTemplateCopy,
} from "../copy"
import { SponsorshipEmailShell } from "../_design"
import { SponsorshipInfoStack } from "./info_stack"

export interface InternalInvoiceEmailProps extends SponsorshipEmailContext {
  competitionName: string
  adminUrl: string
  message?: string
}

export function InternalInvoiceEmail(props: InternalInvoiceEmailProps) {
  const copy = sponsorshipEmailTemplateCopy("internal_invoice", props)
  const showNextSteps = Boolean(props.winnerSponsorName)

  return (
    <SponsorshipEmailShell
      preview={copy.preview}
      title={copy.title}
      subtitle={copy.subtitle}
      ctaLabel={copy.ctaLabel}
      ctaUrl={props.adminUrl}
    >
      <Section>
        <SponsorshipInfoStack rows={copy.infoRows} />
        {props.message !== undefined && props.message.length > 0 ? (
          <Section className="mt-3">
            <Hr className="border-brand-border" />
            <Text className="m-0 mt-3 text-sm font-medium text-brand-foreground">
              {props.message}
            </Text>
          </Section>
        ) : null}
        {showNextSteps ? (
          <Section className="mt-3 rounded-lg border border-brand-border px-4 py-3">
            <Text className="m-0 text-xs text-brand-muted">Next steps</Text>
            {INTERNAL_INVOICE_NEXT_STEPS.map((step) => (
              <Text
                key={step}
                className="m-0 mt-1 text-sm leading-6 text-brand-foreground"
              >
                {step}
              </Text>
            ))}
          </Section>
        ) : null}
      </Section>
    </SponsorshipEmailShell>
  )
}
