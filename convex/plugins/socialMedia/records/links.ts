/**
 * WCA Live's public site and GraphQL endpoint. It has no staging instance, so
 * every deployment reads production whatever `DEPLOYMENT_CONTEXT` says; the
 * records query is public and read-only, so that is safe.
 */
export const WCA_LIVE_URL = "https://live.worldcubeassociation.org"

/**
 * The WCA's production site. WCA Live only knows production competition and
 * person ids, so records are checked and linked against production too; the
 * endpoints used are public and read-only.
 */
export const WCA_URL = "https://www.worldcubeassociation.org"

/** WCA Live, as the WCA has no results for the competition until they are posted. */
export function liveCompetitionUrl(liveCompetitionId: string): string {
  return `${WCA_LIVE_URL}/competitions/${encodeURIComponent(liveCompetitionId)}`
}

/** The WCA's posted results, which stay up long after WCA Live drops them. */
export function wcaCompetitionResultsUrl(wcaCompetitionId: string): string {
  return `${WCA_URL}/competitions/${encodeURIComponent(wcaCompetitionId)}/results/all`
}

/** The WCA's results once they are posted, WCA Live's until then. */
export function competitionResultsUrl(competition: {
  resultsPosted: boolean
  liveCompetitionId: string
  wcaCompetitionId: string
}): string {
  return competition.resultsPosted
    ? wcaCompetitionResultsUrl(competition.wcaCompetitionId)
    : liveCompetitionUrl(competition.liveCompetitionId)
}

/** WCA Live only knows production WCA IDs, so profiles link to production too. */
export function wcaPersonUrl(wcaId: string): string {
  return `${WCA_URL}/persons/${encodeURIComponent(wcaId)}`
}
