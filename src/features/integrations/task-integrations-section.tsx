import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { TASK_INTEGRATION_CARDS } from "@/plugins/integrations/registry"
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
        const Card = TASK_INTEGRATION_CARDS.get(row.integrationId)
        if (Card === undefined) {
          return null
        }
        return <Card key={row._id} row={row} />
      })}
    </>
  )
}
