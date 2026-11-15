import { z } from "zod"
import { WCA_URL } from "@/convex/plugins/socialMedia/records/links"

/**
 * A competition as the WCA's public API lists or returns it, trimmed to what
 * records need. The generated `CompetitionInfo` type omits `results_posted_at`,
 * though the WCA returns it, so responses are parsed here instead.
 */
const wcaCompetitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  /** The venue's country. */
  country_iso2: z.string(),
  results_posted_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
})

export type WcaCompetition = z.infer<typeof wcaCompetitionSchema>

const wcaResultSchema = z.object({
  /** The result's id; a single and an average record can share it. */
  id: z.number(),
  round_id: z.number(),
  /** "1", "2", "3", "f", their cutoff variants, "b" or a qualification round. */
  round_type_id: z.string(),
  event_id: z.string(),
  name: z.string(),
  wca_id: z.string(),
  country_iso2: z.string(),
  best: z.number(),
  average: z.number(),
  /** "NR", "WR", or a continental code such as "ER"; null for no record. */
  regional_single_record: z.string().nullable(),
  regional_average_record: z.string().nullable(),
})

export type WcaResult = z.infer<typeof wcaResultSchema>

/** As many competitions as the WCA lists per page. */
const COMPETITIONS_PER_PAGE = 100

/** Far more pages than any window of competitions the records scan reaches. */
const MAX_COMPETITION_PAGES = 50

async function fetchWcaJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`${WCA_URL}/api/v0${path}`, {
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    throw new Error(
      `WCA lookup of ${path} failed (HTTP ${String(response.status)}).`
    )
  }
  const parsed = schema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error(`WCA lookup of ${path} returned an invalid response.`)
  }
  return parsed.data
}

export async function fetchCompetition(
  wcaCompetitionId: string
): Promise<WcaCompetition> {
  return await fetchWcaJson(
    `/competitions/${encodeURIComponent(wcaCompetitionId)}`,
    wcaCompetitionSchema
  )
}

/** The competition's posted results; only meaningful once they are posted. */
export async function fetchResults(
  wcaCompetitionId: string
): Promise<WcaResult[]> {
  return await fetchWcaJson(
    `/competitions/${encodeURIComponent(wcaCompetitionId)}/results`,
    z.array(wcaResultSchema)
  )
}

/**
 * Every competition, worldwide and however it was scored, that started on or
 * after `from` and ended by `to` (YYYY-MM-DD dates).
 */
export async function listCompetitions(
  from: string,
  to: string
): Promise<WcaCompetition[]> {
  const competitions: WcaCompetition[] = []
  for (let page = 1; page <= MAX_COMPETITION_PAGES; page++) {
    const query = new URLSearchParams({
      start: from,
      end: to,
      per_page: String(COMPETITIONS_PER_PAGE),
      page: String(page),
    })
    const batch = await fetchWcaJson(
      `/competitions?${query.toString()}`,
      z.array(wcaCompetitionSchema)
    )
    competitions.push(...batch)
    if (batch.length < COMPETITIONS_PER_PAGE) return competitions
  }
  throw new Error(
    `The WCA listed more than ${String(MAX_COMPETITION_PAGES * COMPETITIONS_PER_PAGE)} competitions from ${from} to ${to}.`
  )
}
