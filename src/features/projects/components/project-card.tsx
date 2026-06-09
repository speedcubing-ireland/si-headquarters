import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PHASE_COLOR_CLASSES } from "@/components/data-selectors/phase-meta"
import { PROJECT_STATUS_LABELS } from "@/features/projects/project-status"
import type { ProjectStatus } from "@/convex/projects/statuses"
import { Link } from "@tanstack/react-router"
import { MilestoneIcon } from "lucide-react"
import type { ProjectCardSummary } from "@/convex/projects/model"

export type { ProjectCardSummary }

const PROJECT_STATUS_BADGE_CLASS_NAMES = {
  planning: "border-border text-muted-foreground",
  active:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  paused:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  complete: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  cancelled:
    "border-destructive/30 bg-destructive/10 text-destructive dark:text-destructive",
} as const satisfies Record<ProjectStatus, string>

export function ProjectCard({ project }: { project: ProjectCardSummary }) {
  return (
    <Link
      to="/projects/$id"
      params={{ id: project._id }}
      className="block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card
        size="sm"
        className="h-full gap-0 py-0 ring-foreground/10 transition-shadow hover:shadow-md hover:ring-foreground/20"
      >
        <CardHeader className="gap-2 px-3 pt-3 pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 min-w-0 text-sm leading-snug">
              {project.name}
            </CardTitle>
            <Badge
              variant="outline"
              className={PROJECT_STATUS_BADGE_CLASS_NAMES[project.status]}
            >
              {PROJECT_STATUS_LABELS[project.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col px-3 pb-3 text-sm text-muted-foreground">
          <p className="line-clamp-3 leading-relaxed">
            {project.description ?? (
              <span className="italic opacity-70">No description yet.</span>
            )}
          </p>
        </CardContent>
        {project.phaseName !== null ? (
          <CardFooter className="min-h-9 gap-2 px-3 py-2 text-xs text-muted-foreground">
            <MilestoneIcon className="size-3.5 shrink-0" />
            <span
              className={`size-2 rounded-full ${PHASE_COLOR_CLASSES[project.phaseColor ?? "gray"]}`}
              aria-hidden="true"
            />
            <span className="truncate font-medium">{project.phaseName}</span>
          </CardFooter>
        ) : null}
      </Card>
    </Link>
  )
}
