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
      <Section className="bg-brand-subtle rounded-lg px-4 py-3">
        <Text className="text-brand-muted m-0 text-xs">Getting started</Text>
        {INVITE_GETTING_STARTED_STEPS.map((step) => (
          <Text
            key={step}
            className="text-brand-foreground m-0 mt-1 text-sm leading-6"
          >
            {step}
          </Text>
        ))}
      </Section>
      <Section className="border-brand-border mt-3 rounded-lg border px-4 py-3">
        <Text className="text-brand-muted m-0 text-xs">Portal URL</Text>
        <Text className="text-brand-foreground m-0 mt-1 text-xs leading-5 wrap-anywhere">
          <Link href={props.portalUrl}>{props.portalUrl}</Link>
        </Text>
        <Text className="text-brand-muted m-0 mt-2 text-xs leading-5">
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
