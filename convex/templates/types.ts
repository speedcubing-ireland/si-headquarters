import type { Doc } from "@/convex/_generated/dataModel"
import type { TeamName } from "@/convex/permissions/shared"
import type { TaskIntegrationId } from "@/convex/plugins/core/validators"
import type { TaskLabelCode } from "@/convex/tasks/labels/constants"
import type { TaskKind } from "@/convex/tasks/kind"
import type { TaskReviewerRef } from "@/convex/tasks/reviews/validators"
import type { TaskStatus } from "@/convex/tasks/status/validators"
import type {
  templateCompetitionInput,
  TemplateVariableType,
  TemplateVariableValue,
} from "@/convex/templates/validators"
import type { Infer } from "convex/values"

export interface TemplateVariableDefinition {
  key: string
  label: string
  type: TemplateVariableType
  required?: boolean
  description?: string
  defaultValue?: TemplateVariableValue
  teamName?: TeamName
}

export type DateAnchor =
  | { type: "competitionStart" }
  | { type: "competitionEnd" }
  | { type: "variable"; key: string }

export interface RelativeDateExpression {
  anchor: DateAnchor
  offsetDays?: number
}

export type TaskOwnerExpression =
  | { type: "teamName"; teamName: TeamName }
  | { type: "competitionRole"; role: "compLead" | "leadDelegate" }
  | { type: "variable"; key: string }
  | null

export type TaskAssigneesExpression =
  | "assignable"
  | { type: "competitionRole"; role: "compLead" | "leadDelegate" }
  | { type: "competitionOrganisers" }
  | { type: "variable"; key: string }
  | null

export type ReviewerExpression =
  | { type: "teamName"; teamName: TeamName }
  | { type: "competitionRole"; role: "compLead" | "leadDelegate" }
  | { type: "variable"; key: string }

export interface CompetitionResourceTemplateSpec {
  resourceType: Doc<"competitionLinkedResources">["resourceType"]
  resourceKey: string
  data: Doc<"competitionLinkedResources">["data"]
}

export interface CompetitionTemplateTaskSpec {
  key: string
  name: string
  description?: string | null
  kind?: TaskKind
  status?: TaskStatus
  dueDate?: RelativeDateExpression | null
  owner?: TaskOwnerExpression
  assignees?: TaskAssigneesExpression
  reviewers?: readonly ReviewerExpression[]
  /** Codes from {@link DEFAULT_TASK_LABELS} / {@link TASK_LABEL_CODES}. */
  labels?: readonly TaskLabelCode[]
  integrationIds?: readonly TaskIntegrationId[]
  blockedBy?: readonly string[]
  subtasks?: readonly CompetitionTemplateTaskSpec[]
}

export interface CompetitionTemplatePhaseSpec {
  key: string
  name: string
  color: Doc<"phases">["color"]
  tasks?: readonly CompetitionTemplateTaskSpec[]
}

export interface CompetitionTemplateDefinition {
  key: string
  version: number
  name: string
  description?: string
  variables?: readonly TemplateVariableDefinition[]
  phases: readonly CompetitionTemplatePhaseSpec[]
  initialPhaseKey?: string
  linkedResources?: readonly CompetitionResourceTemplateSpec[]
}

export type TemplateCompetitionInput = Infer<typeof templateCompetitionInput>

export type ResolvedReviewerRef = TaskReviewerRef
