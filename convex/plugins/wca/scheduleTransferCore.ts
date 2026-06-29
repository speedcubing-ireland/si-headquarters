"use node"

import { fromZonedTime } from "date-fns-tz"
import type {
  RegistrationDataV2,
  WcifActivity as Activity,
  WcifAdvancementCondition,
  WcifEvent as Event,
  WcifPerson,
  WcifRound as Round,
  WcifSchedule as Schedule,
  WcifVenue as Venue,
  WcifRoom as Room,
  WcifTimeLimit,
} from "@/convex/plugins/wca/openapiClient/types.gen"
import { createWcaClient } from "@/convex/plugins/wca/client"
import {
  competitionById,
  getRegistrationsAdmin,
} from "@/convex/plugins/wca/openapiClient/sdk.gen"
import {
  loadCompetitionWcif,
  patchCompetitionWcif,
} from "@/convex/plugins/wca/wcifCompetition"
import {
  clearSheetRange,
  fetchSchedule,
  writeSheetRange,
} from "@/convex/plugins/sheets/googleApi"
import {
  normalizeScheduleName,
  parseProgressionRows,
  wcaEventIdForScheduleName,
  type ProgressionRow,
  type ScheduleReadResult,
} from "@/convex/plugins/sheets/schedule"
import {
  getRegistrationStatus,
  isAcceptedRegistration,
} from "@/convex/plugins/wca/registrationsLib"
import {
  checkinSheetsConfig,
  organisationConfig,
} from "@/config/lib/organisation"

type WcaApiClient = ReturnType<typeof createWcaClient>
type GoogleSheetCellValue = string | null

async function clearGoogleSheetValues(args: {
  accessToken: string
  spreadsheetId: string
  range: string
}): Promise<void> {
  await clearSheetRange(args.accessToken, args.spreadsheetId, args.range)
}

async function updateGoogleSheetValues(args: {
  accessToken: string
  spreadsheetId: string
  range: string
  values: GoogleSheetCellValue[][]
}): Promise<void> {
  const normalized = args.values.map((row) => row.map((cell) => cell ?? ""))
  await writeSheetRange(
    args.accessToken,
    args.spreadsheetId,
    args.range,
    normalized
  )
}

const WCA_DATA_CLEAR_RANGE = "WCA Data!A3:U"
const WCA_DATA_WRITE_RANGE = "WCA Data!A3"
const SCHEDULE_TIMEZONE = organisationConfig.regional.timeZone

function scheduleTemplateCompetitionId(): string {
  return checkinSheetsConfig().wca.scheduleTemplateCompetitionId
}
const PERCENT_75_THRESHOLD_MIN = 72
const PERCENT_75_THRESHOLD_MAX = 78
const CHECKIN_EVENT_COLUMNS = [
  "333",
  "222",
  "444",
  "555",
  "666",
  "777",
  "333bf",
  "333fm",
  "clock",
  "pyram",
  "skewb",
  "333mbf",
] as const
const REGION_DISPLAY_NAMES =
  typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null

export const MULTI_ATTEMPT_EVENTS = new Set(["333fm", "333mbf"])

interface OtherActivityDef {
  activityCode: string
  displayName: string
}

const OTHER_ACTIVITIES: Record<string, OtherActivityDef> = {
  "intro to competing": {
    activityCode: "other-tutorial",
    displayName: "Tutorial for new competitors",
  },
  awards: {
    activityCode: "other-awards",
    displayName: "Awards",
  },
  "registration opens": {
    activityCode: "other-checkin",
    displayName: "Check-in",
  },
  lunch: {
    activityCode: "other-lunch",
    displayName: "Lunch",
  },
  "lunch (sat)": {
    activityCode: "other-lunch",
    displayName: "Lunch",
  },
  "lunch (sun)": {
    activityCode: "other-lunch",
    displayName: "Lunch",
  },
}

const ROUND_FORMATS: Record<string, "1" | "2" | "3" | "5" | "a" | "m"> = {
  "333fm-1": "3",
  "333fm-2": "2",
  "333fm-3": "m",
  "333mbf-1": "3",
  "333mbf-2": "2",
  "333mbf-3": "3",
  "333bf": "5",
  "666": "m",
  "777": "m",
  "444bf": "3",
  "555bf": "3",
}

export function getRoundFormat(
  eventId: string,
  attemptCount: number
): "1" | "2" | "3" | "5" | "a" | "m" {
  const key = `${eventId}-${String(attemptCount)}`
  if (key in ROUND_FORMATS) {
    return ROUND_FORMATS[key]
  }
  if (eventId in ROUND_FORMATS) {
    return ROUND_FORMATS[eventId]
  }
  return "a"
}

function defaultTimeLimit(eventId: string) {
  if (eventId === "333fm" || eventId === "333mbf") return undefined
  return { centiseconds: 60000, cumulativeRoundIds: [] }
}

function getActivityCode(name: string, round: number): string {
  const normalized = normalizeScheduleName(name)
  const eventId = wcaEventIdForScheduleName(normalized)

  if (eventId !== undefined) {
    return `${eventId}-r${String(round)}`
  }

  if (normalized in OTHER_ACTIVITIES) {
    return OTHER_ACTIVITIES[normalized].activityCode
  }

  throw new Error(
    `Unknown activity: "${name}". Must be a valid event or one of: Intro to competing, Awards, Registration Opens, Lunch`
  )
}

function getActivityDisplayName(name: string): string {
  const normalized = normalizeScheduleName(name)

  if (normalized in OTHER_ACTIVITIES) {
    return OTHER_ACTIVITIES[normalized].displayName
  }

  return name
}

function isEvent(name: string): boolean {
  return wcaEventIdForScheduleName(name) !== undefined
}

interface SheetRow {
  time: string
  length: string
  event: string
  round: string
}

function parseDuration(length: string): number {
  const [hours = 0, minutes = 0] = length.split(":").map(Number)
  return (
    (Number.isFinite(hours) ? hours : 0) * 60 +
    (Number.isFinite(minutes) ? minutes : 0)
  )
}

function parseSheetRows(rows: string[][]): SheetRow[] {
  return rows
    .map((row) => ({
      time: (row[0] ?? "").trim(),
      length: (row[1] ?? "").trim(),
      event: (row[2] ?? "").trim(),
      round: (row[3] ?? "").trim(),
    }))
    .filter((r) => r.time && r.event)
}

function buildAdvancementCondition(
  previousRoundSize: number,
  progressionValue: number | null
): WcifAdvancementCondition | undefined {
  if (progressionValue === null || previousRoundSize <= 0) return undefined

  const percentValue = (progressionValue / previousRoundSize) * 100
  const isApprox75 =
    percentValue >= PERCENT_75_THRESHOLD_MIN &&
    percentValue <= PERCENT_75_THRESHOLD_MAX

  if (isApprox75) {
    return { type: "percent", level: 75 }
  }
  return { type: "ranking", level: Math.round(progressionValue) }
}

function parseScheduleRows(schedule: ScheduleReadResult): {
  saturday: SheetRow[]
  sunday: SheetRow[]
} {
  return {
    saturday: parseSheetRows(schedule.saturday),
    sunday: parseSheetRows(schedule.sunday),
  }
}

function firstNameFromFullName(name: string): string {
  const [firstName = ""] = name.trim().split(/\s+/)
  return firstName
}

function buildWcifPersonLookup(persons: WcifPerson[] | undefined) {
  const byUserId = new Map<number, WcifPerson>()
  const byRegistrantId = new Map<number, WcifPerson>()

  for (const person of persons ?? []) {
    if (person.wcaUserId) {
      byUserId.set(person.wcaUserId, person)
    }
    if (person.registrantId) {
      byRegistrantId.set(person.registrantId, person)
    }
  }

  return { byUserId, byRegistrantId }
}

function resolvePersonForRegistration(
  registration: RegistrationDataV2,
  lookup: ReturnType<typeof buildWcifPersonLookup>
): WcifPerson | undefined {
  return (
    lookup.byUserId.get(registration.user_id) ??
    lookup.byRegistrantId.get(registration.registrant_id)
  )
}

function countryIso2ToName(countryIso2: string): string {
  const normalized = countryIso2.trim().toUpperCase()
  if (!normalized) return ""
  if (!REGION_DISPLAY_NAMES) return normalized
  return REGION_DISPLAY_NAMES.of(normalized) ?? normalized
}
function blankToNull(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim()
  return normalized ? normalized : null
}

export function buildCheckinSheetRows(
  registrations: RegistrationDataV2[],
  wcifPersons: WcifPerson[] | undefined
): GoogleSheetCellValue[][] {
  const collator = new Intl.Collator(undefined, { sensitivity: "base" })
  const personLookup = buildWcifPersonLookup(wcifPersons)

  const rows = registrations
    .filter(isAcceptedRegistration)
    .map((registration) => {
      const registrationStatus = getRegistrationStatus(registration)
      const name = registration.user.name.trim()
      const firstName = firstNameFromFullName(name)
      const eventIds = new Set(registration.competing.event_ids)
      const person = resolvePersonForRegistration(registration, personLookup)

      return {
        firstName,
        name,
        sortKey: `${firstName} ${name}`.trim(),
        registrantId: registration.registrant_id,
        row: [
          blankToNull(registrationStatus),
          blankToNull(name),
          blankToNull(countryIso2ToName(registration.user.country_iso2.trim())),
          blankToNull(registration.user.wca_id),
          blankToNull(person?.birthdate),
          blankToNull(registration.user.gender),
          ...CHECKIN_EVENT_COLUMNS.map((eventId) =>
            eventIds.has(eventId) ? ("1" as const) : null
          ),
          blankToNull(person?.email),
          typeof registration.guests === "number"
            ? String(registration.guests)
            : null,
          null,
        ],
      }
    })

  rows.sort((a, b) => {
    const firstNameCmp = collator.compare(a.firstName, b.firstName)
    if (firstNameCmp !== 0) return firstNameCmp
    const nameCmp = collator.compare(a.name, b.name)
    if (nameCmp !== 0) return nameCmp
    const sortKeyCmp = collator.compare(a.sortKey, b.sortKey)
    if (sortKeyCmp !== 0) return sortKeyCmp
    return a.registrantId - b.registrantId
  })

  return rows.map((entry) => entry.row)
}

function formatScheduleTime(
  dateStr: string,
  hours: number,
  minutes: number
): string {
  const localTimeStr = `${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`
  return fromZonedTime(localTimeStr, SCHEDULE_TIMEZONE).toISOString()
}

function getNextDay(dateStr: string): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + 1)
  return date.toISOString().split("T")[0]
}

function buildActivity(row: SheetRow, dateStr: string, id: number): Activity {
  const [hours, minutes] = row.time.split(":").map(Number)
  const durationMin = parseDuration(row.length)

  const startDate = new Date(`${dateStr}T00:00:00`)
  startDate.setHours(hours, minutes, 0, 0)
  const endDate = new Date(startDate.getTime() + durationMin * 60_000)

  const roundNum = Number.parseInt(row.round, 10) || 1
  const activityCode = getActivityCode(row.event, roundNum)
  const isEventActivity = isEvent(row.event)
  const name = isEventActivity
    ? `${row.event}, Round ${String(roundNum)}`
    : getActivityDisplayName(row.event)

  return {
    id,
    name,
    activityCode,
    startTime: formatScheduleTime(dateStr, hours, minutes),
    endTime: formatScheduleTime(
      dateStr,
      endDate.getHours(),
      endDate.getMinutes()
    ),
    childActivities: [],
    scrambleSetId: undefined,
    extensions: [],
  }
}

function buildDayActivities(
  rows: SheetRow[],
  dateStr: string,
  startId: number
): { activities: Activity[]; nextId: number } {
  const activities: Activity[] = []
  let id = startId

  for (const row of rows) {
    const durationMin = parseDuration(row.length)
    if (durationMin <= 0) continue

    activities.push(buildActivity(row, dateStr, id++))
  }

  return { activities, nextId: id }
}

async function fetchScheduleTemplate(
  client: WcaApiClient
): Promise<Map<string, Round>> {
  const wcif = await loadCompetitionWcif(
    client,
    scheduleTemplateCompetitionId()
  )
  if (!wcif) return new Map()
  return new Map(
    wcif.events.flatMap((event) =>
      event.rounds.map((round) => [round.id, round] as const)
    )
  )
}

async function fetchCompetitionVenueInfo(
  client: WcaApiClient,
  competitionId: string
): Promise<{
  name: string
  detail: string
  lat: number
  lng: number
  country: string
} | null> {
  const r = await competitionById({
    client,
    path: { competitionId },
  })
  if (r.data === undefined) {
    return null
  }
  const info = r.data
  return {
    name: info.venue,
    detail: info.venue_details ?? "Main Stage",
    lat: info.latitude_degrees,
    lng: info.longitude_degrees,
    country: info.country_iso2,
  }
}

function buildCompetitionActivities(
  scheduleData: { saturday: SheetRow[]; sunday: SheetRow[] },
  startDate: string,
  numberOfDays: number
): Activity[] {
  const daySchedules: { rows: SheetRow[]; date: string }[] = [
    { rows: scheduleData.saturday, date: startDate },
  ]
  if (numberOfDays > 1) {
    daySchedules.push({
      rows: scheduleData.sunday,
      date: getNextDay(startDate),
    })
  }

  let nextId = 1
  const allActivities: Activity[] = []
  for (const daySchedule of daySchedules) {
    const built = buildDayActivities(daySchedule.rows, daySchedule.date, nextId)
    allActivities.push(...built.activities)
    nextId = built.nextId
  }
  return allActivities
}

function extractEventRounds(activities: Activity[]): Map<string, Set<number>> {
  const rounds = new Map<string, Set<number>>()

  const eventRoundPattern = /^([a-z0-9]+)-r(\d+)$/
  for (const activity of activities) {
    const match = eventRoundPattern.exec(activity.activityCode)
    if (match === null) continue

    const eventId = match[1]
    const roundStr = match[2]

    if (!rounds.has(eventId)) rounds.set(eventId, new Set())
    rounds.get(eventId)?.add(Number(roundStr))
  }

  return rounds
}

function countMultiAttempts(activities: Activity[]): Map<string, number> {
  const counts = new Map<string, number>()

  const multiAttemptPattern = /^([a-z0-9]+)-r/
  for (const activity of activities) {
    const match = multiAttemptPattern.exec(activity.activityCode)
    if (match === null) continue

    const eventId = match[1]
    if (!MULTI_ATTEMPT_EVENTS.has(eventId)) {
      continue
    }

    const previous = counts.get(eventId) ?? 0
    counts.set(eventId, previous + 1)
  }

  return counts
}

function createRound(
  roundId: string,
  eventId: string,
  isMultiAttempt: boolean,
  attemptCount: number,
  existingRound: Round | undefined,
  templateRound: Round | undefined,
  progressionCondition: WcifAdvancementCondition | undefined,
  overwriteEvents: boolean
): Round {
  if (existingRound && !overwriteEvents) return existingRound

  if (templateRound) {
    return {
      id: roundId,
      format: templateRound.format,
      timeLimit: templateRound.timeLimit,
      cutoff: templateRound.cutoff,
      advancementCondition:
        progressionCondition ?? templateRound.advancementCondition,
      results: [],
      scrambleSetCount: templateRound.scrambleSetCount,
      scrambleSets: templateRound.scrambleSets,
      extensions: [],
    }
  }

  const format = getRoundFormat(eventId, isMultiAttempt ? attemptCount : 1)
  const timeLimit: WcifTimeLimit | undefined = defaultTimeLimit(eventId)

  return {
    id: roundId,
    format,
    timeLimit,
    cutoff: undefined,
    advancementCondition: progressionCondition,
    results: [],
    scrambleSetCount: 1,
    scrambleSets: [],
    extensions: [],
  }
}

function buildEvents(
  activities: Activity[],
  existingEvents: Event[],
  templateRounds: Map<string, Round>,
  progressionRows: ProgressionRow[],
  overwriteEvents: boolean
): Event[] {
  const roundsMap = extractEventRounds(activities)
  const attemptCounts = countMultiAttempts(activities)
  const existingEventsMap = new Map<string, Event>(
    existingEvents.map((e) => [e.id, e])
  )
  const progressionMap = new Map<string, ProgressionRow>(
    progressionRows.map((r) => [r.eventId, r])
  )

  const events: Event[] = []

  for (const [eventId, roundNums] of roundsMap) {
    const existingEvent = existingEventsMap.get(eventId)
    const sortedRounds = [...roundNums].sort((a, b) => a - b)
    const isMultiAttempt = MULTI_ATTEMPT_EVENTS.has(eventId)
    const attemptCount = attemptCounts.get(eventId) ?? sortedRounds.length
    const progressionRow = progressionMap.get(eventId)

    const rounds: Round[] = sortedRounds.map((roundNum, idx) => {
      const roundId = `${eventId}-r${String(roundNum)}`
      const existingRound = existingEvent?.rounds.find((r) => r.id === roundId)
      const templateRound = templateRounds.get(roundId)

      let progressionCondition: WcifAdvancementCondition | undefined
      if (progressionRow && idx + 1 < progressionRow.progressions.length) {
        const previousSize = progressionRow.progressions[idx]
        const progressionValue = progressionRow.progressions[idx + 1]
        if (previousSize !== null && previousSize > 0) {
          progressionCondition = buildAdvancementCondition(
            previousSize,
            progressionValue
          )
        }
      }

      return createRound(
        roundId,
        eventId,
        isMultiAttempt,
        attemptCount,
        existingRound,
        templateRound,
        progressionCondition,
        overwriteEvents
      )
    })

    events.push({
      id: eventId,
      rounds,
      extensions: existingEvent?.extensions ?? [],
      competitorLimit: existingEvent?.competitorLimit,
      qualification: existingEvent?.qualification,
    })
  }

  return events
}

function buildRoom(
  existingVenue: Venue | undefined,
  venueInfo: { detail: string } | null,
  activities: Activity[]
): Room {
  const primaryRoom =
    existingVenue !== undefined ? existingVenue.rooms[0] : undefined
  return {
    id: primaryRoom?.id ?? 1,
    name: primaryRoom?.name ?? venueInfo?.detail ?? "Main Stage",
    color: primaryRoom?.color ?? "#304a96",
    activities,
    extensions: [],
  }
}

function buildVenue(
  existingVenue: Venue | undefined,
  venueInfo: { name: string; lat: number; lng: number; country: string } | null,
  room: Room
): Venue {
  if (existingVenue) {
    return { ...existingVenue, rooms: [room] }
  }

  return {
    id: 1,
    name: venueInfo?.name ?? "Main Venue",
    latitudeMicrodegrees: Math.round((venueInfo?.lat ?? 0) * 1e6),
    longitudeMicrodegrees: Math.round((venueInfo?.lng ?? 0) * 1e6),
    countryIso2: venueInfo?.country ?? "IE",
    timezone: SCHEDULE_TIMEZONE,
    rooms: [room],
    extensions: [],
  }
}

export async function executePushScheduleToWca(input: {
  googleAccessToken: string
  wcaAccessToken: string
  sheetId: string
  wcaCompetitionId: string
  overwriteEvents?: boolean
}): Promise<
  | { success: true; activitiesCreated: number }
  | { success: false; error: string }
> {
  const overwriteEvents = input.overwriteEvents ?? false
  const wcaClient = createWcaClient(input.wcaAccessToken)

  let scheduleSheet: ScheduleReadResult
  try {
    scheduleSheet = await fetchSchedule(input.googleAccessToken, input.sheetId)
  } catch (err) {
    return {
      success: false,
      error: `Failed to read sheet: ${err instanceof Error ? err.message : "Unknown error"}`,
    }
  }

  const scheduleData = parseScheduleRows(scheduleSheet)
  if (scheduleData.saturday.length === 0 && scheduleData.sunday.length === 0) {
    return { success: false, error: "No schedule entries found in the sheet" }
  }

  const wcif = await loadCompetitionWcif(wcaClient, input.wcaCompetitionId)
  if (wcif === null) {
    return { success: false, error: "Failed to fetch WCIF from WCA" }
  }

  const hasExistingVenue = wcif.schedule.venues.length > 0

  const [templateRounds, venueInfo] = await Promise.all([
    fetchScheduleTemplate(wcaClient),
    hasExistingVenue
      ? Promise.resolve(null)
      : fetchCompetitionVenueInfo(wcaClient, input.wcaCompetitionId),
  ])
  const progressionRows = parseProgressionRows(scheduleSheet.progression)

  const startDate = wcif.schedule.startDate
  const allActivities = buildCompetitionActivities(
    scheduleData,
    startDate,
    wcif.schedule.numberOfDays
  )

  const existingVenue = hasExistingVenue ? wcif.schedule.venues[0] : undefined
  const room = buildRoom(existingVenue, venueInfo, allActivities)
  const venue = buildVenue(existingVenue, venueInfo, room)

  const schedule: Schedule = {
    startDate,
    numberOfDays: wcif.schedule.numberOfDays,
    venues: [venue],
  }

  const events = buildEvents(
    allActivities,
    wcif.events,
    templateRounds,
    progressionRows,
    overwriteEvents
  )

  if (events.length === 0) {
    return {
      success: false,
      error:
        "No events with rounds found in schedule. Check that your sheet has valid event names.",
    }
  }

  const emptyRoundEvents = events.filter((e) => e.rounds.length === 0)
  if (emptyRoundEvents.length > 0) {
    return {
      success: false,
      error: `Events without rounds: ${emptyRoundEvents.map((e) => e.id).join(", ")}`,
    }
  }

  const result = await patchCompetitionWcif(
    input.wcaAccessToken,
    input.wcaCompetitionId,
    {
      id: wcif.id,
      events,
      schedule,
    }
  )

  if (!result.success) {
    return result
  }

  return { success: true, activitiesCreated: allActivities.length }
}

export async function executePopulateCheckin(input: {
  googleAccessToken: string
  wcaAccessToken: string
  sheetId: string
  wcaCompetitionId: string
}): Promise<
  { success: true; rowsWritten: number } | { success: false; error: string }
> {
  const wcaClient = createWcaClient(input.wcaAccessToken)

  const registrationsResponse = await getRegistrationsAdmin({
    client: wcaClient,
    path: { competitionId: input.wcaCompetitionId },
  })
  if (registrationsResponse.error !== undefined) {
    return {
      success: false,
      error: `Failed to fetch admin competition registrations: ${JSON.stringify(registrationsResponse.error)}`,
    }
  }

  const registrations = Array.isArray(registrationsResponse.data)
    ? registrationsResponse.data
    : []
  const hasStatusFields = registrations.some(
    (registration) => getRegistrationStatus(registration) !== ""
  )
  if (registrations.length > 0 && !hasStatusFields) {
    return {
      success: false,
      error:
        "WCA admin registrations are missing status fields. Ensure your WCA token has organizer/delegate access for this competition.",
    }
  }

  const wcif = await loadCompetitionWcif(wcaClient, input.wcaCompetitionId)
  const rows = buildCheckinSheetRows(registrations, wcif?.persons)

  try {
    await clearGoogleSheetValues({
      accessToken: input.googleAccessToken,
      spreadsheetId: input.sheetId,
      range: WCA_DATA_CLEAR_RANGE,
    })
    if (rows.length > 0) {
      await updateGoogleSheetValues({
        accessToken: input.googleAccessToken,
        spreadsheetId: input.sheetId,
        range: WCA_DATA_WRITE_RANGE,
        values: rows,
      })
    }
  } catch (err) {
    return {
      success: false,
      error: `Failed to update check-in sheet: ${err instanceof Error ? err.message : "Unknown error"}`,
    }
  }

  return { success: true, rowsWritten: rows.length }
}
