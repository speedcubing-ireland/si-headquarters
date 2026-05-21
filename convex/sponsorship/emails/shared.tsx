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
  type TailwindConfig,
  pixelBasedPreset,
} from "@react-email/components"
import type { ReactNode } from "react"

const emailTailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#c2792a",
          "primary-fg": "#ffffff",
          bg: "#fcfaf7",
          surface: "#ffffff",
          foreground: "#4a3628",
          muted: "#6b5b4e",
          border: "#ddd5ca",
        },
      },
    },
  },
} satisfies TailwindConfig

type SponsorshipEmailShellProps = {
  preview: string
  title: string
  subtitle?: string
  ctaLabel?: string
  ctaUrl?: string
  children: ReactNode
}

export function SponsorshipEmailShell(props: SponsorshipEmailShellProps) {
  return (
    <Html lang="en">
      <Tailwind config={emailTailwindConfig}>
        <Head>
          <Font
            fontFamily="Montserrat"
            fallbackFontFamily="Helvetica"
            webFont={{
              url: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXp-p7K4KLg.woff2",
              format: "woff2",
            }}
          />
        </Head>
        <Body className="bg-brand-bg py-10 font-sans">
          <Preview>{props.preview}</Preview>
          <Container className="border-brand-border bg-brand-surface mx-auto max-w-xl rounded-xl border border-solid px-6 py-6">
            <Text className="text-brand-muted m-0 text-xs tracking-wide uppercase">
              Speedcubing Ireland Sponsorship
            </Text>
            <Heading
              as="h1"
              className="text-brand-foreground m-0 mt-2 text-xl font-bold"
            >
              {props.title}
            </Heading>
            {props.subtitle ? (
              <Text className="text-brand-foreground m-0 mt-2 text-sm leading-6">
                {props.subtitle}
              </Text>
            ) : null}
            <Section className="mt-4">{props.children}</Section>
            <Text className="text-brand-muted m-0 mt-4 text-xs leading-5">
              Need help with {props.title}? Reply to this email and the
              Sponsorship Team will assist.
            </Text>
            {props.ctaLabel && props.ctaUrl ? (
              <Section className="mt-4">
                <Button
                  href={props.ctaUrl}
                  className="bg-brand-primary text-brand-primary-fg box-border block rounded-lg px-6 py-3 text-center text-sm font-semibold no-underline"
                  style={{
                    backgroundColor: "#c2792a",
                    color: "#ffffff",
                    display: "block",
                    textAlign: "center",
                    fontSize: "14px",
                    fontWeight: "600",
                    textDecoration: "none",
                    borderRadius: "8px",
                    padding: "12px 24px",
                  }}
                >
                  {props.ctaLabel}
                </Button>
              </Section>
            ) : null}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-IE", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Dublin",
  })
}

export function SponsorshipInfoBlock(props: { label: string; value: string }) {
  return (
    <Section className="border-brand-border rounded-lg border px-4 py-3">
      <Text className="text-brand-muted m-0 text-xs">{props.label}</Text>
      <Text className="text-brand-foreground m-0 mt-1 text-sm font-semibold">
        {props.value}
      </Text>
    </Section>
  )
}
