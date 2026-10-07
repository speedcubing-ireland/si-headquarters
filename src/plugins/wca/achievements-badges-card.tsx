import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import {
  TaskIntegrationCardShell,
  type TaskIntegrationCardRow,
} from "@/features/integrations/task-integration-card-shell"
import { useQuery } from "convex/react"
import { AwardIcon, ExternalLinkIcon } from "lucide-react"

export function AchievementsBadgesCard({
  row,
}: {
  row: TaskIntegrationCardRow
}) {
  const link = useQuery(api.plugins.wca.achievements.getBadgesLinkForTask, {
    taskId: row.taskId,
  })

  return (
    <TaskIntegrationCardShell
      icon={<AwardIcon className="size-4 text-blue-600" />}
      row={row}
      statusLabel="Link"
      showLastMessage={false}
      actions={() =>
        link?.url == null ? null : (
          <Button asChild type="button" variant="outline">
            <a href={link.url} target="_blank" rel="noreferrer">
              Open SI Achievements
              <ExternalLinkIcon />
            </a>
          </Button>
        )
      }
    >
      {link === undefined ? null : link.wcaCompetitionId === null ? (
        <p className="text-sm text-muted-foreground">
          Link a WCA competition to get its badges page on SI Achievements.
        </p>
      ) : link.url === null ? (
        <p className="text-sm text-muted-foreground">
          The SI Achievements site is not configured for this deployment.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Generate and print competitor badges for {link.wcaCompetitionId}.
        </p>
      )}
    </TaskIntegrationCardShell>
  )
}
