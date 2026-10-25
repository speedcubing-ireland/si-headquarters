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
import { emailBrandTokens as colors } from "@/convex/emails/brand"
import { renderEmailFormats } from "@/convex/emails/render"
import type { CompetitionRecords } from "@/convex/plugins/socialMedia/records/collect"
import { describeRecord } from "@/convex/plugins/socialMedia/records/format"
import {
  competitionResultsUrl,
  wcaPersonUrl,
} from "@/convex/plugins/socialMedia/records/links"
import { formatWeekLabel } from "@/convex/plugins/socialMedia/records/window"
import type { WcaRecord } from "@/convex/plugins/socialMedia/validators"

const RECORD_COLORS: Record<WcaRecord["tag"], string> = {
  NR: colors.primary,
  CR: colors.warning,
  WR: colors.destructive,
}

function RecordLine({ record }: { record: WcaRecord }) {
  return (
    <Text style={{ margin: "0 0 8px", fontSize: "14px", lineHeight: "20px" }}>
      <span
        style={{
          color: RECORD_COLORS[record.tag],
          fontWeight: 700,
        }}
      >
        {record.tag}
      </span>{" "}
      {record.wcaId === null ? (
        <span style={{ fontWeight: 600 }}>{record.personName}</span>
      ) : (
        <Link
          href={wcaPersonUrl(record.wcaId)}
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
                  href={competitionResultsUrl(group)}
                  style={{ color: colors.foreground }}
                >
                  {group.competitionName}
                </Link>
              </Heading>
              {group.records.map((record) => (
                <RecordLine key={record.liveRecordId} record={record} />
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
            Records are as entered on WCA Live until the WCA posts the results,
            which can still change them. Sent every Monday by {footer}.
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
  recordCount: number
}

function countRecords(competitions: readonly CompetitionRecords[]): number {
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
  weekStart: string
): Promise<RenderedEmail> {
  const countryName = countryNameOf(countryIso2)
  const weekLabel = formatWeekLabel(weekStart)
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
  return { subject, html, text: plainText, recordCount }
}
