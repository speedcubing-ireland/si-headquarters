import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { TaskIntegrationStatus } from "@/convex/integrations/taskIntegrations/validators"
import type { ProjectWorkflowRunStatus } from "@/convex/projectWorkflows/validators"
import {
  IntegrationCardActions,
  IntegrationCardBody,
  IntegrationCardDeleteButton,
  IntegrationCardHeader,
  IntegrationCardRoot,
} from "@/features/integrations/integration-card-parts"
import { IntegrationStatusBadge } from "@/features/integrations/integration-status-badge"
import { useMutation, useQuery } from "convex/react"
import { PlayIcon, WorkflowIcon } from "lucide-react"
import { useMemo, useState } from "react"

const projectWorkflowsApi = api.projectWorkflows

const WORKFLOW_STATUS_LABELS = {
  queued: "Queued",
  running: "Running",
  completed: "Complete",
  attention: "Attention",
  noop: "No action",
  failed: "Failed",
} as const satisfies Record<ProjectWorkflowRunStatus, string>

function workflowCardStatus(
  latestRunStatus: ProjectWorkflowRunStatus | undefined
): TaskIntegrationStatus {
  switch (latestRunStatus) {
    case "queued":
    case "running":
      return "running"
    case "completed":
      return "completed"
    case "attention":
    case "failed":
      return "error"
    case "noop":
    case undefined:
      return "idle"
  }
}

function WorkflowRunDetails({
  latestRun,
}: {
  latestRun:
    | {
        status: ProjectWorkflowRunStatus
        summary: string | null
        error: string | null
      }
    | undefined
}) {
  if (latestRun === undefined) {
    return <span className="text-sm text-muted-foreground">No runs yet.</span>
  }
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <IntegrationStatusBadge
        status={workflowCardStatus(latestRun.status)}
        label={WORKFLOW_STATUS_LABELS[latestRun.status]}
      />
      <p className="line-clamp-2 text-sm text-muted-foreground">
        {latestRun.summary ?? latestRun.error ?? "Run pending."}
      </p>
    </div>
  )
}

export function ProjectWorkflowButton({
  projectId,
}: {
  projectId: Id<"projects">
}) {
  const definitions = useQuery(projectWorkflowsApi.queries.listDefinitions, {})
  const installed = useQuery(projectWorkflowsApi.queries.listForProject, {
    projectId,
  })
  const install = useMutation(projectWorkflowsApi.mutations.install)
  const [open, setOpen] = useState(false)
  const [pendingInstallId, setPendingInstallId] = useState<string | null>(null)
  const installedIds = useMemo(
    () => new Set((installed ?? []).map((row) => row.workflowId)),
    [installed]
  )
  const availableDefinitions =
    definitions?.filter((definition) => !installedIds.has(definition.id)) ?? []
  const isLoading = definitions === undefined || installed === undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={isLoading || availableDefinitions.length === 0}
        >
          <WorkflowIcon />
          Add workflow
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search workflows..." />
          <CommandList>
            <CommandEmpty>No workflows available.</CommandEmpty>
            <CommandGroup>
              {availableDefinitions.map((definition) => (
                <CommandItem
                  key={definition.id}
                  value={`${definition.label} ${definition.id}`}
                  disabled={pendingInstallId !== null}
                  onSelect={() => {
                    setPendingInstallId(definition.id)
                    void install({
                      projectId,
                      workflowId: definition.id,
                    })
                      .then(() => {
                        setOpen(false)
                      })
                      .finally(() => {
                        setPendingInstallId(null)
                      })
                  }}
                >
                  <WorkflowIcon />
                  <div className="min-w-0">
                    <p className="truncate">{definition.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {definition.description}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ProjectWorkflowCard({
  canUpdate,
  projectWorkflowId,
  label,
  description,
  enabled,
}: {
  canUpdate: boolean
  projectWorkflowId: Id<"projectWorkflows">
  label: string
  description: string
  enabled: boolean
}) {
  const runs = useQuery(projectWorkflowsApi.queries.listRuns, {
    projectWorkflowId,
  })
  const latestRun = runs?.at(-1)
  const runNow = useMutation(projectWorkflowsApi.mutations.runNow)
  const setEnabled = useMutation(projectWorkflowsApi.mutations.setEnabled)
  const remove = useMutation(projectWorkflowsApi.mutations.remove)
  const [pending, setPending] = useState<"remove" | "run" | null>(null)

  return (
    <IntegrationCardRoot>
      <IntegrationCardHeader
        icon={<WorkflowIcon className="size-4" />}
        title={label}
        status={workflowCardStatus(latestRun?.status)}
      >
        <Switch
          checked={enabled}
          aria-label={`Toggle ${label}`}
          disabled={!canUpdate}
          onCheckedChange={(nextEnabled) => {
            void setEnabled({ id: projectWorkflowId, enabled: nextEnabled })
          }}
        />
        {canUpdate ? (
          <IntegrationCardDeleteButton
            disabled={pending === "remove"}
            onDelete={() => {
              setPending("remove")
              void remove({ id: projectWorkflowId }).finally(() => {
                setPending(null)
              })
            }}
          />
        ) : null}
      </IntegrationCardHeader>
      <IntegrationCardBody>
        <p className="text-sm text-muted-foreground">{description}</p>
      </IntegrationCardBody>
      <IntegrationCardBody>
        {runs === undefined ? (
          <span className="text-sm text-muted-foreground">Loading runs...</span>
        ) : (
          <WorkflowRunDetails latestRun={latestRun} />
        )}
      </IntegrationCardBody>
      <IntegrationCardActions>
        <Button
          variant="outline"
          disabled={!canUpdate || !enabled || pending === "run"}
          onClick={() => {
            setPending("run")
            void runNow({ id: projectWorkflowId }).finally(() => {
              setPending(null)
            })
          }}
        >
          <PlayIcon />
          Run
        </Button>
      </IntegrationCardActions>
    </IntegrationCardRoot>
  )
}

export function ProjectWorkflowsCard({
  canUpdate,
  projectId,
}: {
  canUpdate: boolean
  projectId: Id<"projects">
}) {
  const installed = useQuery(projectWorkflowsApi.queries.listForProject, {
    projectId,
  })

  if (installed === undefined || installed.length === 0) {
    return null
  }

  return (
    <>
      {installed.map((row) => (
        <ProjectWorkflowCard
          key={row._id}
          canUpdate={canUpdate}
          projectWorkflowId={row._id}
          label={row.definition.label}
          description={row.definition.description}
          enabled={row.enabled}
        />
      ))}
    </>
  )
}
