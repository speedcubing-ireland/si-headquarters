import { render, Section, Text } from "@react-email/components"
import { sponsorPortalLoginUrl } from "../../lib/siteUrls"
import { SponsorshipEmailShell } from "./shared"

export type SponsorPortalOtpEmailProps = {
  otp: string
  purposeLabel:
    | "sign in"
    | "reset your password"
    | "verify your email"
    | "change your email"
  expiresInMinutes: number
  portalUrl: string
}

export default function SponsorPortalOtpEmail(
  props: SponsorPortalOtpEmailProps
) {
  const title =
    props.purposeLabel === "reset your password"
      ? "Your password reset code"
      : props.purposeLabel === "change your email"
        ? "Your email change code"
        : "Your sign-in code"
  return (
    <SponsorshipEmailShell
      preview={`${props.otp} is your Speedcubing Ireland Sponsor Portal code`}
      title={title}
      subtitle={`Use the code below to ${props.purposeLabel} on the Speedcubing Ireland Sponsor Portal.`}
      ctaLabel="Open sponsor portal"
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

export async function renderSponsorPortalOtpEmail(
  props: SponsorPortalOtpEmailProps
): Promise<{ html: string; plainText: string }> {
  const component = <SponsorPortalOtpEmail {...props} />
  const [html, plainText] = await Promise.all([
    render(component),
    render(component, { plainText: true }),
  ])
  return { html, plainText }
}

SponsorPortalOtpEmail.PreviewProps = {
  otp: "847291",
  purposeLabel: "sign in",
  expiresInMinutes: 60,
  portalUrl: sponsorPortalLoginUrl(),
} satisfies SponsorPortalOtpEmailProps
