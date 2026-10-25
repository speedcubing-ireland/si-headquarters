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
import {
  type CompetitionRecords,
  WCA_LIVE_URL,
  type WeeklyRecord,
} from "@/convex/plugins/socialMedia/records/collect"
import {
  formatWcaResult,
  type RecordKind,
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

/** WCA Live, as the WCA has no results for the competition until they are posted. */
function liveCompetitionUrl(liveCompetitionId: string): string {
  return `${WCA_LIVE_URL}/competitions/${encodeURIComponent(liveCompetitionId)}`
}

function personUrl(wcaId: string): string {
  return `${resolveWcaBaseUrl()}/persons/${encodeURIComponent(wcaId)}`
}

function describeRecord(record: WeeklyRecord): string {
  const result = formatWcaResult(record.eventId, record.type, record.value)
  return `${formatWcaEventLabel(record.eventId)} ${record.type} ${result} (${record.roundName})`
}

function RecordLine({ record }: { record: WeeklyRecord }) {
  return (
    <Text style={{ margin: "0 0 8px", fontSize: "14px", lineHeight: "20px" }}>
      <span
        style={{
          color: RECORD_COLORS[record.marker],
          fontWeight: 700,
        }}
      >
        {record.marker}
      </span>{" "}
      {record.wcaId === null ? (
        <span style={{ fontWeight: 600 }}>{record.personName}</span>
      ) : (
        <Link
          href={personUrl(record.wcaId)}
          style={{ color: colors.foreground, fontWeight: 600 }}
        >
          {record.personName}
        </Link>
      )}{" "}
      — {describeRecord(record)}
    </Text>
  )
}

export function WeeklyRecordsEmail({
  competitions,
  countryName,
  weekLabel,
}: {
  competitions: readonly CompetitionRecords[]
  countryName: string
  weekLabel: string
}) {
  const footer = organisationConfig.branding.notificationFooterText
  const intro =
    competitions.length === 0
      ? `No competitor from ${countryName} set an NR, CR or WR at a competition that ended in the week of ${weekLabel}.`
      : `Records for ${countryName} from competitions that ended in the week of ${weekLabel}:`

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
              ? `No new records for ${countryName} this week`
              : `New records for ${countryName}`}
          </Heading>
          <Text style={{ fontSize: "14px", margin: "0 0 16px" }}>{intro}</Text>
          {competitions.map((group) => (
            <Section
              key={group.liveCompetitionId}
              style={{ marginBottom: "16px" }}
            >
              <Heading as="h2" style={{ fontSize: "16px", margin: "0 0 8px" }}>
                <Link
                  href={liveCompetitionUrl(group.liveCompetitionId)}
                  style={{ color: colors.foreground }}
                >
                  {group.competitionName}
                </Link>
              </Heading>
              {group.records.map((record) => (
                <RecordLine
                  key={`${record.personName}:${record.eventId}:${String(record.roundNumber)}:${record.type}`}
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
            Records as entered on WCA Live; they become official once the WCA
            posts the results. Sent every Monday by {footer}.
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

/** "Ireland" for "IE", in the organisation's locale. */
function countryNameOf(countryIso2: string): string {
  return (
    new Intl.DisplayNames(organisationConfig.regional.locale, {
      type: "region",
    }).of(countryIso2) ?? countryIso2
  )
}

export async function renderWeeklyRecordsEmail(
  competitions: readonly CompetitionRecords[],
  countryIso2: string,
  window: WeekWindow
): Promise<RenderedEmail> {
  const countryName = countryNameOf(countryIso2)
  const weekLabel = formatWeekLabel(window)
  const recordCount = countRecords(competitions)
  const subject =
    recordCount === 0
      ? `No new records for ${countryName}: ${weekLabel}`
      : `Records for ${countryName}: ${weekLabel} (${String(recordCount)})`
  const { html, plainText } = await renderEmailFormats(
    <WeeklyRecordsEmail
      competitions={competitions}
      countryName={countryName}
      weekLabel={weekLabel}
    />
  )
  return { subject, html, text: plainText }
}
