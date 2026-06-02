import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { INTEGRATION_PLUGINS } from "@/plugins/integrations/registry"
import { useQuery } from "convex/react"

export function TaskIntegrationsSection({ taskId }: { taskId: Id<"tasks"> }) {
  const integrations = useQuery(api.plugins.core.taskIntegrations.listForTask, {
    taskId,
  })

  if (integrations === undefined || integrations.length === 0) {
    return null
  }

  return (
    <>
      {integrations.map((row) => {
        const plugin = INTEGRATION_PLUGINS.find((p) =>
          p.taskIntegrationIds.includes(row.integrationId)
        )
        const Card = plugin?.taskIntegrationCards[row.integrationId]
        if (Card === undefined) {
          return null
        }
        return <Card key={row._id} row={row} taskId={taskId} />
      })}
    </>
  )
}
