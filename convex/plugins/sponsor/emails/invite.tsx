import { Link, Section, Text } from "@react-email/components"
import {
  INVITE_GETTING_STARTED_STEPS,
  INVITE_PORTAL_URL_HINT,
  sponsorshipEmailTemplateCopy,
} from "./copy"
import {
  buildInviteProps,
  type BuildEmailInput,
  type InviteEmailProps,
} from "./_build"
import { SponsorshipEmailShell } from "./_design"
import { fixtures } from "./fixtures"

function InviteEmail(props: InviteEmailProps) {
  const copy = sponsorshipEmailTemplateCopy("invite", {
    sponsorName: props.sponsorName,
  })

  return (
    <SponsorshipEmailShell
      preview={copy.preview}
      title={copy.title}
      subtitle={copy.subtitle}
      ctaLabel={copy.ctaLabel}
      ctaUrl={props.portalUrl}
    >
      <Section className="rounded-lg bg-brand-subtle px-4 py-3">
        <Text className="m-0 text-xs text-brand-muted">Getting started</Text>
        {INVITE_GETTING_STARTED_STEPS.map((step) => (
          <Text
            key={step}
            className="m-0 mt-1 text-sm leading-6 text-brand-foreground"
          >
            {step}
          </Text>
        ))}
      </Section>
      <Section className="mt-3 rounded-lg border border-brand-border px-4 py-3">
        <Text className="m-0 text-xs text-brand-muted">Portal URL</Text>
        <Text className="m-0 mt-1 text-xs leading-5 text-brand-foreground wrap-anywhere">
          <Link href={props.portalUrl}>{props.portalUrl}</Link>
        </Text>
        <Text className="m-0 mt-2 text-xs leading-5 text-brand-muted">
          {INVITE_PORTAL_URL_HINT}
        </Text>
      </Section>
    </SponsorshipEmailShell>
  )
}

InviteEmail.PreviewProps = fixtures.invite
export default InviteEmail

export function buildElement(input: BuildEmailInput) {
  return <InviteEmail {...buildInviteProps(input)} />
}
