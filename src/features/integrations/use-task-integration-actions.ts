import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
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
    run: (input?: { overwriteEvents?: boolean }) =>
      run("run", async () => {
        await runMutation({ id: row._id, input: input ?? {} })
      }),
    detach: () =>
      run("delete", async () => {
        await detachMutation({ id: row._id })
      }),
    confirmShare: () =>
      run("confirm", async () => {
        await confirmMutation({
          id: row._id,
          expectedStatus: "awaiting_manual_share",
          completedMessage: "Manual step confirmed.",
        })
      }),
    confirmEvents: () =>
      run("confirm", async () => {
        await confirmMutation({
          id: row._id,
          expectedStatus: "awaiting_manual_events_confirmation",
          completedMessage: "WCA schedule upload confirmed.",
        })
      }),
  }
}
