import {
  IntegrationCardActions,
  IntegrationCardAlert,
  IntegrationCardAlertDescription,
  IntegrationCardBody,
  IntegrationCardDeleteButton,
  IntegrationCardHeader,
  IntegrationCardRoot,
} from "@/features/integrations/integration-card-parts"
import type { Doc } from "@/convex/_generated/dataModel"
import type {
  TaskIntegrationId,
  TaskIntegrationStatus,
} from "@/convex/plugins/core/types"
import { isIntegrationStatus } from "@/features/integrations/integration-status"
import { useTaskIntegrationActions } from "@/features/integrations/use-task-integration-actions"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export type TaskIntegrationCardActions = ReturnType<
  typeof useTaskIntegrationActions
>

export type TaskIntegrationCardRow = Doc<"taskIntegrations"> & {
  definition: {
    id: TaskIntegrationId
    label: string
    pluginId: string
  }
}

export interface TaskIntegrationCardContext {
  actions: TaskIntegrationCardActions
  row: TaskIntegrationCardRow
  status: TaskIntegrationStatus
}

export function TaskIntegrationCardShell({
  actions: renderActions,
  alert,
  children,
  icon,
  lastMessageClassName,
  row,
  showLastMessage = true,
  title,
}: {
  actions?: (context: TaskIntegrationCardContext) => ReactNode
  alert?: (context: TaskIntegrationCardContext) => ReactNode
  children?: ReactNode
  icon: ReactNode
  lastMessageClassName?: string
  row: TaskIntegrationCardRow
  showLastMessage?: boolean
  title?: string
}) {
  const actions = useTaskIntegrationActions(row)
  const status = isIntegrationStatus(row.status) ? row.status : "idle"
  const context = { actions, row, status }
  const resolvedAlert = alert?.(context)
  const resolvedActions = renderActions?.(context)

  return (
    <IntegrationCardRoot>
      <IntegrationCardHeader
        icon={icon}
        title={title ?? row.definition.label}
        status={status}
      >
        <IntegrationCardDeleteButton
          disabled={actions.pending === "delete"}
          onDelete={() => {
            void actions.detach()
          }}
        />
      </IntegrationCardHeader>
      {isFilled(resolvedAlert) ? (
        <IntegrationCardAlert>
          <IntegrationCardAlertDescription>
            {resolvedAlert}
          </IntegrationCardAlertDescription>
        </IntegrationCardAlert>
      ) : null}
      {isFilled(children) ? (
        <IntegrationCardBody>{children}</IntegrationCardBody>
      ) : null}
      {showLastMessage && row.lastMessage !== null ? (
        <IntegrationCardBody>
          <p
            className={cn(
              "text-sm",
              status === "error" ? "text-destructive" : "text-muted-foreground",
              lastMessageClassName
            )}
          >
            {row.lastMessage}
          </p>
        </IntegrationCardBody>
      ) : null}
      {actions.error !== null ? (
        <IntegrationCardBody>
          <p className="text-sm text-destructive">{actions.error}</p>
        </IntegrationCardBody>
      ) : null}
      {isFilled(resolvedActions) ? (
        <IntegrationCardActions>{resolvedActions}</IntegrationCardActions>
      ) : null}
    </IntegrationCardRoot>
  )
}

function isFilled(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false
}
