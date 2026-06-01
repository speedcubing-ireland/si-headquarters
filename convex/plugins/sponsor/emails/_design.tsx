import {
  Body,
  Button,
  Container,
  Font,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components"
import type { TailwindConfig } from "@react-email/components"
import { pixelBasedPreset } from "@react-email/components"
import type { ReactNode } from "react"

/** Hex brand tokens aligned with the HQ app theme (light mode). */
export const emailBrandTokens = {
  primary: "#2f9e64",
  primaryFg: "#fafffe",
  bg: "#fafafa",
  surface: "#ffffff",
  foreground: "#18181b",
  muted: "#71717a",
  border: "#e4e4e7",
  subtle: "#f4f4f5",
  destructive: "#dc2626",
  warning: "#f59e0b",
} as const

const emailTailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: emailBrandTokens.primary,
          "primary-fg": emailBrandTokens.primaryFg,
          bg: emailBrandTokens.bg,
          surface: emailBrandTokens.surface,
          foreground: emailBrandTokens.foreground,
          muted: emailBrandTokens.muted,
          border: emailBrandTokens.border,
          subtle: emailBrandTokens.subtle,
          destructive: emailBrandTokens.destructive,
          warning: emailBrandTokens.warning,
        },
      },
    },
  },
} satisfies TailwindConfig

const emailCtaButtonStyle = {
  backgroundColor: emailBrandTokens.primary,
  color: emailBrandTokens.primaryFg,
  display: "block",
  textAlign: "center" as const,
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  borderRadius: "8px",
  padding: "12px 24px",
}

function EmailFont() {
  return (
    <Font
      fontFamily="Noto Sans"
      fallbackFontFamily="Helvetica"
      webFont={{
        url: "https://fonts.gstatic.com/s/notosans/v42/o-0bIpQlx3QUlC5A4PNB6RJiA6CsXq.woff2",
        format: "woff2",
      }}
    />
  )
}

interface SponsorshipEmailShellProps {
  preview: string
  title: string
  subtitle?: string
  ctaLabel?: string
  ctaUrl?: string
  children: ReactNode
}

export function SponsorshipEmailShell(props: SponsorshipEmailShellProps) {
  const showCta =
    props.ctaLabel !== undefined &&
    props.ctaLabel.length > 0 &&
    props.ctaUrl !== undefined &&
    props.ctaUrl.length > 0

  return (
    <Html lang="en">
      <Tailwind config={emailTailwindConfig}>
        <Head>
          <EmailFont />
        </Head>
        <Body className="bg-brand-bg font-sans py-10">
          <Preview>{props.preview}</Preview>
          <Container className="mx-auto max-w-xl overflow-hidden rounded-xl border border-solid border-brand-border bg-brand-surface">
            <Section className="bg-brand-primary px-6 py-4">
              <Text className="m-0 text-xs font-semibold uppercase tracking-wide text-brand-primary-fg">
                Speedcubing Ireland · Sponsorship
              </Text>
            </Section>
            <Section className="px-6 py-6">
              <Heading
                as="h1"
                className="m-0 text-xl font-bold text-brand-foreground"
              >
                {props.title}
              </Heading>
              {props.subtitle !== undefined && props.subtitle.length > 0 ? (
                <Text className="m-0 mt-2 text-sm leading-6 text-brand-foreground">
                  {props.subtitle}
                </Text>
              ) : null}
              <Section className="mt-4">{props.children}</Section>
              <Text className="m-0 mt-4 text-xs leading-5 text-brand-muted">
                Need help with {props.title}? Reply to this email and the
                Sponsorship Team will assist.
              </Text>
              {showCta ? (
                <Section className="mt-4">
                  <Button href={props.ctaUrl} style={emailCtaButtonStyle}>
                    {props.ctaLabel}
                  </Button>
                </Section>
              ) : null}
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export function formatEmailDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-IE", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Dublin",
  })
}

export function SponsorshipInfoBlock(props: { label: string; value: string }) {
  return (
    <Section className="rounded-lg border border-brand-border px-4 py-3">
      <Text className="m-0 text-xs text-brand-muted">{props.label}</Text>
      <Text className="m-0 mt-1 text-sm font-semibold text-brand-foreground">
        {props.value}
      </Text>
    </Section>
  )
}

export function formatMoney(cents: number, currency = "EUR"): string {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

export function formatRecipientSubtitle(
  recipientName: string | undefined,
  messageForNamed: (name: string) => string,
  messageAnonymous: string,
): string {
  if (recipientName !== undefined && recipientName.length > 0) {
    return messageForNamed(recipientName)
  }
  return messageAnonymous
}
