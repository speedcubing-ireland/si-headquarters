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
  render,
} from "@react-email/components"
import { organisationConfig } from "@/config/lib/organisation"
import { resolveWcaBaseUrl } from "@/convex/deploymentContext"
import { formatWcaEventLabel } from "@/convex/plugins/wca/eventLabels"
import type { WeeklyRecord } from "@/convex/plugins/socialMedia/records/collect"
import {
  formatWcaResult,
  recordKind,
  recordLabel,
  roundLabel,
} from "@/convex/plugins/socialMedia/records/format"
import {
  formatWeekLabel,
  type WeekWindow,
} from "@/convex/plugins/socialMedia/records/window"

const colors = {
  bg: "#fafafa",
  surface: "#ffffff",
  foreground: "#18181b",
  muted: "#71717a",
  border: "#e4e4e7",
  NR: "#2f9e64",
  CR: "#d97706",
  WR: "#dc2626",
} as const

interface CompetitionRecords {
  competitionId: string
  competitionName: string
  records: WeeklyRecord[]
}

/** Records arrive sorted by competition, so grouping keeps that order. */
function groupByCompetition(
  records: readonly WeeklyRecord[]
): CompetitionRecords[] {
  const groups = new Map<string, CompetitionRecords>()
  for (const record of records) {
    const group = groups.get(record.competitionId) ?? {
      competitionId: record.competitionId,
      competitionName: record.competitionName,
      records: [],
    }
    group.records.push(record)
    groups.set(record.competitionId, group)
  }
  return [...groups.values()]
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
          color: colors[recordKind(record.marker)],
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
  records,
  weekLabel,
}: {
  records: readonly WeeklyRecord[]
  weekLabel: string
}) {
  const footer = organisationConfig.branding.notificationFooterText
  const intro =
    records.length === 0
      ? `No Irish competitor set an NR, CR or WR at a competition whose results were posted in the week of ${weekLabel}.`
      : `Irish records from competitions whose results were posted in the week of ${weekLabel}:`

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
            {records.length === 0
              ? "No new Irish records this week"
              : "New Irish records"}
          </Heading>
          <Text style={{ fontSize: "14px", margin: "0 0 16px" }}>{intro}</Text>
          {groupByCompetition(records).map((group) => (
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

export async function renderWeeklyRecordsEmail(
  records: readonly WeeklyRecord[],
  window: WeekWindow
): Promise<RenderedEmail> {
  const weekLabel = formatWeekLabel(window)
  const subject =
    records.length === 0
      ? `No new Irish records: ${weekLabel}`
      : `Irish records: ${weekLabel} (${String(records.length)})`
  const element = <WeeklyRecordsEmail records={records} weekLabel={weekLabel} />
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ])
  return { subject, html, text }
}
