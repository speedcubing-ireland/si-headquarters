/**
 * WCA Live's public site and GraphQL endpoint. It has no staging instance, so
 * every deployment reads production whatever `DEPLOYMENT_CONTEXT` says; the
 * records query is public and read-only, so that is safe.
 */
export const WCA_LIVE_URL = "https://live.worldcubeassociation.org"

/** WCA Live, as the WCA has no results for the competition until they are posted. */
export function liveCompetitionUrl(liveCompetitionId: string): string {
  return `${WCA_LIVE_URL}/competitions/${encodeURIComponent(liveCompetitionId)}`
}

/** WCA Live only knows production WCA IDs, so profiles link to production too. */
export function wcaPersonUrl(wcaId: string): string {
  return `https://www.worldcubeassociation.org/persons/${encodeURIComponent(wcaId)}`
}
