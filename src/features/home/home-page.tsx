import { Dot } from "@/components/data-selectors/phase-selector"
import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"
import { PageListMessage } from "@/components/layout/page-list-message"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import {
  formatCompetitionCountdown,
  formatCompetitionDateRange,
} from "@/features/competitions/competition-date-range-display"
import { TaskCompLink } from "@/features/tasks/components/task-comp-link"
import { cn } from "@/lib/utils"
import { Link } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  ArrowRightIcon,
  CircleAlertIcon,
  CornerDownRightIcon,
} from "lucide-react"
import { useState } from "react"

type HomeData = FunctionReturnType<typeof api.dashboard.queries.getHome>
type TaskAction = HomeData["actionNeeded"][number]
type CompetitionWithWork = HomeData["competitionsWithWork"][number]

const ACTION_LABELS = {
  "open-task": "Open task",
  view: "View",
  claim: "Claim",
  start: "Start",
  complete: "Complete",
} satisfies Record<TaskAction["primaryAction"], string>

function taskUrlParams(task: TaskAction["task"]) {
  return { id: task.path.taskTitleId }
}

function taskActionKey(action: TaskAction) {
  return `${action.reason}:${action.task.task._id}`
}

function HomeSectionHeader({
  title,
  count,
  to,
}: {
  title: string
  count: number
  to: "/tasks" | "/competitions"
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <h2 className="font-heading text-base font-semibold">{title}</h2>
      <Badge variant="secondary" className="tabular-nums">
        {count}
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="ml-auto h-8 shrink-0"
      >
        <Link to={to}>
          View all
          <ArrowRightIcon />
        </Link>
      </Button>
    </div>
  )
}

function TaskActionButton({ item }: { item: TaskAction }) {
  const [pending, setPending] = useState(false)
  const claimTask = useMutation(api.tasks.mutations.claimTask)
  const setTaskStatus = useMutation(api.tasks.mutations.setTaskStatus)
  const action = item.primaryAction
  const label = ACTION_LABELS[action]

  if (action === "open-task" || action === "view") {
    return (
      <Button
        variant="outline"
        size="sm"
        asChild
        className="w-full @md/main:w-auto @md/main:min-w-24"
      >
        <Link to="/tasks/$id" params={taskUrlParams(item.task)}>
          {label}
        </Link>
      </Button>
    )
  }

  async function runAction() {
    setPending(true)
    try {
      if (action === "claim") {
        await claimTask({ id: item.task.task._id })
      } else if (action === "start") {
        await setTaskStatus({ id: item.task.task._id, status: "in-progress" })
      } else if (action === "complete") {
        await setTaskStatus({ id: item.task.task._id, status: "done" })
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() => {
        void runAction()
      }}
      className="w-full @md/main:w-auto @md/main:min-w-24"
    >
      {pending ? "Working" : label}
    </Button>
  )
}

function TaskContextLine({ item }: { item: TaskAction }) {
  const row = item.task
  const parentId = row.path.subtaskTitleId
  const hasParent = parentId !== null && row.path.subtaskTitle.length > 0
  const showDueDate = item.reason === "overdue" && row.task.dueDate !== null

  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      {hasParent ? (
        <Link
          to="/tasks/$id"
          params={{ id: parentId }}
          title={row.path.subtaskTitle}
          className="inline-flex max-w-full min-w-0 items-center gap-1 hover:text-foreground hover:underline"
        >
          <CornerDownRightIcon className="size-3 shrink-0" />
          <span className="truncate">{row.path.subtaskTitle}</span>
        </Link>
      ) : null}
      {row.competitionId !== null ? (
        <TaskCompLink row={row} className="h-6 px-1.5 text-[10px]" />
      ) : null}
      {showDueDate ? (
        <Badge variant="outline" className="font-mono">
          Due {row.task.dueDate}
        </Badge>
      ) : null}
    </div>
  )
}

function TaskActionRow({
  item,
  compact = false,
}: {
  item: TaskAction
  compact?: boolean
}) {
  return (
    <article className="rounded-md border bg-card/75 px-3 py-2.5">
      <div className="flex min-w-0 flex-col gap-2.5 @md/main:flex-row @md/main:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge
              variant={
                item.reason === "blocking" || item.reason === "overdue"
                  ? "destructive"
                  : "secondary"
              }
            >
              {item.reasonLabel}
            </Badge>
            <Link
              to="/tasks/$id"
              params={taskUrlParams(item.task)}
              title={item.task.path.taskTitle}
              className="line-clamp-2 min-w-0 text-sm leading-snug font-medium hover:underline"
            >
              {item.task.path.taskTitle}
            </Link>
          </div>
          {compact ? null : (
            <p className="mt-1 text-sm text-muted-foreground">
              {item.explanation}
            </p>
          )}
          <TaskContextLine item={item} />
        </div>
        <div className="flex @md/main:justify-start">
          <TaskActionButton item={item} />
        </div>
      </div>
    </article>
  )
}

function ActionNeededSection({ actions }: { actions: TaskAction[] }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <HomeSectionHeader
        title="Action needed"
        count={actions.length}
        to="/tasks"
      />
      {actions.length > 0 ? (
        <div className="grid gap-2">
          {actions.map((item) => (
            <TaskActionRow key={taskActionKey(item)} item={item} />
          ))}
        </div>
      ) : (
        <PageListMessage>Nothing needs you right now.</PageListMessage>
      )}
    </section>
  )
}

function AssignedWorkSection({ actions }: { actions: TaskAction[] }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <HomeSectionHeader
        title="Assigned to me"
        count={actions.length}
        to="/tasks"
      />
      {actions.length > 0 ? (
        <div className="grid gap-2">
          {actions.map((item) => (
            <TaskActionRow key={taskActionKey(item)} item={item} compact />
          ))}
        </div>
      ) : (
        <PageListMessage>No other assigned work is open.</PageListMessage>
      )}
    </section>
  )
}

function CompetitionWorkCounts({
  competition,
}: {
  competition: CompetitionWithWork
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <Badge variant="secondary">
        {String(competition.activeTaskCount)} active
      </Badge>
      {competition.blockedTaskCount > 0 ? (
        <Badge variant="destructive">
          {String(competition.blockedTaskCount)} blocked
        </Badge>
      ) : null}
      {competition.overdueTaskCount > 0 ? (
        <Badge variant="destructive">
          {String(competition.overdueTaskCount)} overdue
        </Badge>
      ) : null}
    </div>
  )
}

function CompetitionWorkRow({
  competition,
}: {
  competition: CompetitionWithWork
}) {
  const hasRisk =
    competition.blockedTaskCount > 0 || competition.overdueTaskCount > 0

  return (
    <article className="rounded-md border bg-card/75 px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-3">
        <CircleAlertIcon
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground",
            hasRisk && "text-destructive"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-2">
            <Link
              to="/competitions/$id"
              params={{ id: competition._id }}
              className="line-clamp-2 min-w-0 text-sm leading-snug font-medium hover:underline"
            >
              {competition.name}
            </Link>
            <Badge
              variant="secondary"
              className="ml-auto shrink-0 tabular-nums"
            >
              {formatCompetitionCountdown(competition.compDates)}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatCompetitionDateRange(competition.compDates)}</span>
            {competition.phase ? (
              <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5">
                <Dot className="size-2" color={competition.phase.color} />
                {competition.phase.name}
              </span>
            ) : null}
          </div>
          <CompetitionWorkCounts competition={competition} />
          <Button variant="outline" size="sm" asChild className="mt-3 w-full">
            <Link to="/competitions/$id" params={{ id: competition._id }}>
              Open work
            </Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

function CompetitionsWithWorkSection({
  competitions,
}: {
  competitions: CompetitionWithWork[]
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <HomeSectionHeader
        title="Competitions with work"
        count={competitions.length}
        to="/competitions"
      />
      {competitions.length > 0 ? (
        <div className="grid gap-2">
          {competitions.map((competition) => (
            <CompetitionWorkRow
              key={competition._id}
              competition={competition}
            />
          ))}
        </div>
      ) : (
        <PageListMessage>
          No competitions have active work left.
        </PageListMessage>
      )}
    </section>
  )
}

function HomeContent({ data }: { data: HomeData }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="grid min-w-0 gap-6 @2xl/main:grid-cols-[minmax(0,1fr)_minmax(280px,0.62fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <ActionNeededSection actions={data.actionNeeded} />
          <AssignedWorkSection actions={data.assignedWork} />
        </div>
        <CompetitionsWithWorkSection competitions={data.competitionsWithWork} />
      </div>
    </div>
  )
}

export function HomePage() {
  const data = useQuery(api.dashboard.queries.getHome, {})

  return (
    <Page.Shell title="Home" contentClassName={PAGE_CONTENT_PADDING_SCROLL}>
      {data === undefined ? (
        <Page.Status variant="loading" message="Loading home..." />
      ) : (
        <HomeContent data={data} />
      )}
    </Page.Shell>
  )
}
