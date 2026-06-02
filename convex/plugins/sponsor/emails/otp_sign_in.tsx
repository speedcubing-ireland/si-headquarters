import { Section, Text } from "@react-email/components"
import type { SponsorPortalOtpEmailProps } from "@/convex/plugins/sponsor/lib/validators"
import { sponsorOtpEmailTemplateCopy } from "./copy"
import { SponsorshipEmailShell } from "./_design"
import { fixtures } from "./fixtures"

export type { SponsorPortalOtpEmailProps }

function OtpSignInEmail(props: SponsorPortalOtpEmailProps) {
  const copy = sponsorOtpEmailTemplateCopy(props)

  return (
    <SponsorshipEmailShell
      preview={copy.preview}
      title={copy.title}
      subtitle={copy.subtitle}
      ctaLabel={copy.ctaLabel}
      ctaUrl={props.portalUrl}
    >
      <Section className="border-brand-border rounded-lg border px-4 py-4 text-center">
        <Text
          className="text-brand-foreground m-0"
          style={{
            fontFamily: "monospace",
            fontSize: "32px",
            letterSpacing: "0.25em",
            fontWeight: "bold",
          }}
        >
          {props.otp}
        </Text>
        <Text className="text-brand-muted m-0 mt-2 text-xs">
          Expires in {props.expiresInMinutes} minutes
        </Text>
      </Section>
    </SponsorshipEmailShell>
  )
}

OtpSignInEmail.PreviewProps = fixtures.otpSignIn
export default OtpSignInEmail
