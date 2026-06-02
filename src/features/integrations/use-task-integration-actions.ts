import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import type {
  ManualTaskIntegrationStatus,
  TaskIntegrationRunInput,
} from "@/convex/plugins/core/types"
import { useTaggedAsyncAction } from "@/features/integrations/use-async-action"
import { useMutation } from "convex/react"

export function useTaskIntegrationActions(row: Doc<"taskIntegrations">) {
  const runMutation = useMutation(api.plugins.core.taskIntegrations.run)
  const detachMutation = useMutation(api.plugins.core.taskIntegrations.detach)
  const confirmMutation = useMutation(
    api.plugins.core.taskIntegrations.confirmManualStep
  )
  const { pending, error, run } = useTaggedAsyncAction<
    "run" | "delete" | "confirm"
  >()

  return {
    pending,
    error,
    run: (input?: TaskIntegrationRunInput) =>
      run("run", async () => {
        await runMutation({ id: row._id, input: input ?? {} })
      }),
    detach: () =>
      run("delete", async () => {
        await detachMutation({ id: row._id })
      }),
    confirmManualStep: ({
      completedMessage,
      expectedStatus,
    }: {
      completedMessage: string
      expectedStatus: ManualTaskIntegrationStatus
    }) =>
      run("confirm", async () => {
        await confirmMutation({
          id: row._id,
          expectedStatus,
          completedMessage,
        })
      }),
  }
}
