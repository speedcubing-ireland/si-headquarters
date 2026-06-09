import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import type {
  ManualTaskIntegrationStatus,
  TaskIntegrationRunInput,
} from "@/convex/integrations/taskIntegrations/validators"
import { useTaggedAsyncAction } from "@/features/integrations/use-async-action"
import { useMutation } from "convex/react"

export function useTaskIntegrationActions(row: Doc<"taskIntegrations">) {
  const runMutation = useMutation(
    api.integrations.taskIntegrations.mutations.run
  )
  const detachMutation = useMutation(
    api.integrations.taskIntegrations.mutations.detach
  )
  const confirmMutation = useMutation(
    api.integrations.taskIntegrations.mutations.confirmManualStep
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
