import type { Doc } from "@/convex/_generated/dataModel"
import {
  IntegrationCardActions,
  IntegrationCardAlert,
  IntegrationCardAlertDescription,
  IntegrationCardBody,
  IntegrationCardDeleteButton,
  IntegrationCardHeader,
  IntegrationCardRoot,
} from "@/features/integrations/integration-card-parts"
import { isIntegrationStatus } from "@/features/integrations/integration-status"
import { useTaskIntegrationActions } from "@/features/integrations/use-task-integration-actions"
import type { ReactNode } from "react"

export type TaskIntegrationCardActions = ReturnType<
  typeof useTaskIntegrationActions
>

export function TaskIntegrationCardShell({
  children,
  icon,
  renderActions,
  renderAlert,
  row,
  title,
}: {
  children?: ReactNode
  icon: ReactNode
  renderActions: (state: {
    actions: TaskIntegrationCardActions
    status: Doc<"taskIntegrations">["status"]
  }) => ReactNode
  renderAlert?: (state: {
    actions: TaskIntegrationCardActions
    status: Doc<"taskIntegrations">["status"]
  }) => ReactNode
  row: Doc<"taskIntegrations">
  title: string
}) {
  const actions = useTaskIntegrationActions(row)
  const status = isIntegrationStatus(row.status) ? row.status : "idle"
  const state = { actions, status }
  const alert = renderAlert?.(state)

  return (
    <IntegrationCardRoot>
      <IntegrationCardHeader icon={icon} title={title} status={status}>
        <IntegrationCardDeleteButton
          disabled={actions.pending === "delete"}
          onDelete={() => {
            void actions.detach()
          }}
        />
      </IntegrationCardHeader>
      {alert !== null && alert !== undefined ? (
        <IntegrationCardAlert>
          <IntegrationCardAlertDescription>
            {alert}
          </IntegrationCardAlertDescription>
        </IntegrationCardAlert>
      ) : null}
      {children !== null && children !== undefined ? (
        <IntegrationCardBody>{children}</IntegrationCardBody>
      ) : null}
      {row.lastMessage !== null ? (
        <IntegrationCardBody>
          <p className="text-sm text-muted-foreground">{row.lastMessage}</p>
        </IntegrationCardBody>
      ) : null}
      {actions.error !== null ? (
        <IntegrationCardBody>
          <p className="text-sm text-destructive">{actions.error}</p>
        </IntegrationCardBody>
      ) : null}
      <IntegrationCardActions>{renderActions(state)}</IntegrationCardActions>
    </IntegrationCardRoot>
  )
}
