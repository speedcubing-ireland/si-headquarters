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

function CompetitionList({
  competitions,
}: {
  competitions: readonly CompetitionRecords[]
}) {
  return competitions.map((group) => (
    <Section key={group.wcaCompetitionId} style={{ marginBottom: "16px" }}>
      <Heading as="h3" style={{ fontSize: "15px", margin: "0 0 8px" }}>
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
  ))
}

/** One of the email's lists, left out when it has no records. */
function RecordsSection({
  title,
  note,
  competitions,
}: {
  title: string
  note: string
  competitions: readonly CompetitionRecords[]
}) {
  if (competitions.length === 0) return null
  return (
    <Section style={{ marginTop: "8px" }}>
      <Heading as="h2" style={{ fontSize: "17px", margin: "0 0 4px" }}>
        {title}
      </Heading>
      <Text
        style={{ color: colors.muted, fontSize: "13px", margin: "0 0 12px" }}
      >
        {note}
      </Text>
      <CompetitionList competitions={competitions} />
    </Section>
  )
}

export interface WeeklyRecords {
  /**
   * Records the WCA's posted results confirmed: the week's, and earlier weeks'
   * confirmed since the last email.
   */
  confirmed: readonly CompetitionRecords[]
  /** The week's records still as WCA Live entered them. */
  provisional: readonly CompetitionRecords[]
}

export function WeeklyRecordsEmail({
  records,
  countryName,
  weekLabel,
}: {
  records: WeeklyRecords
  countryName: string
  weekLabel: string
}) {
  const footer = organisationConfig.branding.notificationFooterText
  const empty =
    records.confirmed.length === 0 && records.provisional.length === 0
  const intro = empty
    ? `No competitor from ${countryName} set an NR, CR or WR at a competition that ended in the week of ${weekLabel}.`
    : `Records for ${countryName} from competitions that ended in the week of ${weekLabel}, and any the WCA has confirmed since the last email:`

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
            {empty
              ? `No new records for ${countryName} this week`
              : `New records for ${countryName}`}
          </Heading>
          <Text style={{ fontSize: "14px", margin: "0 0 16px" }}>{intro}</Text>
          <RecordsSection
            title="Confirmed"
            note="Confirmed by the results the WCA has posted, including records sent as provisional in an earlier email."
            competitions={records.confirmed}
          />
          <RecordsSection
            title="Provisional"
            note="As entered on WCA Live. The WCA's posted results can still change them; each is sent again once confirmed."
            competitions={records.provisional}
          />
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
  records: WeeklyRecords,
  countryIso2: string,
  weekStart: string
): Promise<RenderedEmail> {
  const countryName = countryNameOf(countryIso2)
  const weekLabel = formatWeekLabel(weekStart)
  const recordCount =
    countRecords(records.confirmed) + countRecords(records.provisional)
  const subject =
    recordCount === 0
      ? `No new records for ${countryName}: ${weekLabel}`
      : `Records for ${countryName}: ${weekLabel} (${String(recordCount)})`
  const { html, plainText } = await renderEmailFormats(
    <WeeklyRecordsEmail
      records={records}
      countryName={countryName}
      weekLabel={weekLabel}
    />
  )
  return { subject, html, text: plainText, recordCount }
}
