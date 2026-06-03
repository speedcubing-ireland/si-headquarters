import { RefreshCw } from "lucide-react"
import { Page } from "@/components/layout/page"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CompetitionCard } from "@/plugins/social-media/components/competition-card"
import type { SocialMediaDashboardCompetition } from "@/plugins/social-media/use-social-media-dashboard"

export function DashboardContent({
  competitions,
  error,
  isFetching,
  hasLoaded,
}: {
  competitions: SocialMediaDashboardCompetition[] | null
  error: string | null
  isFetching: boolean
  hasLoaded: boolean
}) {
  if (!hasLoaded || (isFetching && competitions === null)) {
    return <Page.Status variant="loading" message="Loading competitions…" />
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {error !== null ? (
        <Alert variant="destructive">
          <AlertTitle>Dashboard unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {error === null && competitions?.length === 0 ? (
        <Page.Status
          variant="empty"
          message="No managed future competitions were returned by WCA."
        />
      ) : null}

      {error === null && competitions !== null && competitions.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {competitions.map((competition) => (
            <CompetitionCard
              key={competition.wcaCompetitionId}
              competition={competition}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function DashboardRefreshButton({
  isFetching,
  onRefresh,
}: {
  isFetching: boolean
  onRefresh: () => void | Promise<void>
}) {
  return (
    <Button
      variant="outline"
      onClick={() => {
        void onRefresh()
      }}
      disabled={isFetching}
    >
      <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} />
      Refresh
    </Button>
  )
}
