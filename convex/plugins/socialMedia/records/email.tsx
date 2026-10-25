import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import { organisationConfig } from "@/config/lib/organisation"
import { resolveWcaBaseUrl } from "@/convex/deploymentContext"
import { emailBrandTokens as colors } from "@/convex/emails/brand"
import { renderEmailFormats } from "@/convex/emails/render"
import { formatWcaEventLabel } from "@/convex/plugins/wca/eventLabels"
import type {
  CompetitionRecords,
  WeeklyRecord,
} from "@/convex/plugins/socialMedia/records/collect"
import {
  formatWcaResult,
  type RecordKind,
  recordKind,
  recordLabel,
  roundLabel,
} from "@/convex/plugins/socialMedia/records/format"
import {
  formatWeekLabel,
  type WeekWindow,
} from "@/convex/plugins/socialMedia/records/window"

const RECORD_COLORS: Record<RecordKind, string> = {
  NR: colors.primary,
  CR: colors.warning,
  WR: colors.destructive,
}

function competitionResultsUrl(competitionId: string): string {
  return `${resolveWcaBaseUrl()}/competitions/${encodeURIComponent(competitionId)}/results/all`
}

function personUrl(personId: string): string {
  return `${resolveWcaBaseUrl()}/persons/${encodeURIComponent(personId)}`
}

function describeRecord(record: WeeklyRecord): string {
  const result = formatWcaResult(record.eventId, record.type, record.value)
  return `${formatWcaEventLabel(record.eventId)} ${record.type} ${result} (${roundLabel(record.roundTypeId)})`
}

function RecordLine({ record }: { record: WeeklyRecord }) {
  return (
    <Text style={{ margin: "0 0 8px", fontSize: "14px", lineHeight: "20px" }}>
      <span
        style={{
          color: RECORD_COLORS[recordKind(record.marker)],
          fontWeight: 700,
        }}
      >
        {recordLabel(record.marker)}
      </span>{" "}
      <Link
        href={personUrl(record.personId)}
        style={{ color: colors.foreground, fontWeight: 600 }}
      >
        {record.personName}
      </Link>{" "}
      — {describeRecord(record)}
    </Text>
  )
}

export function WeeklyRecordsEmail({
  competitions,
  countryId,
  weekLabel,
}: {
  competitions: readonly CompetitionRecords[]
  countryId: string
  weekLabel: string
}) {
  const footer = organisationConfig.branding.notificationFooterText
  const intro =
    competitions.length === 0
      ? `No competitor from ${countryId} set an NR, CR or WR at a competition whose results were posted in the week of ${weekLabel}.`
      : `Records for ${countryId} from competitions whose results were posted in the week of ${weekLabel}:`

  return (
    <Html lang="en">
      <Head />
      <Preview>{intro}</Preview>
      <Body
        style={{
          backgroundColor: colors.bg,
          color: colors.foreground,
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <Container
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: "8px",
            margin: "24px auto",
            maxWidth: "600px",
            padding: "24px",
          }}
        >
          <Heading as="h1" style={{ fontSize: "20px", margin: "0 0 12px" }}>
            {competitions.length === 0
              ? `No new records for ${countryId} this week`
              : `New records for ${countryId}`}
          </Heading>
          <Text style={{ fontSize: "14px", margin: "0 0 16px" }}>{intro}</Text>
          {competitions.map((group) => (
            <Section key={group.competitionId} style={{ marginBottom: "16px" }}>
              <Heading as="h2" style={{ fontSize: "16px", margin: "0 0 8px" }}>
                <Link
                  href={competitionResultsUrl(group.competitionId)}
                  style={{ color: colors.foreground }}
                >
                  {group.competitionName}
                </Link>
              </Heading>
              {group.records.map((record) => (
                <RecordLine
                  key={`${record.personId}:${record.eventId}:${record.roundTypeId}:${record.type}`}
                  record={record}
                />
              ))}
            </Section>
          ))}
          <Text
            style={{
              color: colors.muted,
              fontSize: "12px",
              margin: "24px 0 0",
            }}
          >
            Sent every Monday by {footer}.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

export function countRecords(
  competitions: readonly CompetitionRecords[]
): number {
  return competitions.reduce(
    (total, competition) => total + competition.records.length,
    0
  )
}

export async function renderWeeklyRecordsEmail(
  competitions: readonly CompetitionRecords[],
  countryId: string,
  window: WeekWindow
): Promise<RenderedEmail> {
  const weekLabel = formatWeekLabel(window)
  const recordCount = countRecords(competitions)
  const subject =
    recordCount === 0
      ? `No new records for ${countryId}: ${weekLabel}`
      : `Records for ${countryId}: ${weekLabel} (${String(recordCount)})`
  const { html, plainText } = await renderEmailFormats(
    <WeeklyRecordsEmail
      competitions={competitions}
      countryId={countryId}
      weekLabel={weekLabel}
    />
  )
  return { subject, html, text: plainText }
}
