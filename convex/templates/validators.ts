import {
  competitionDatesFields,
  competitionPeopleFields,
} from "@/convex/competitions/validators"
import { v, type Infer } from "convex/values"

export const templateVariableValue = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.null(),
  v.array(v.string())
)

export const templateVariablesArg = v.record(v.string(), templateVariableValue)

export const templateVariableType = v.union(
  v.literal("text"),
  v.literal("date"),
  v.literal("number"),
  v.literal("boolean"),
  v.literal("user"),
  v.literal("users"),
  v.literal("team")
)

export const templateVariableDefinitionView = v.object({
  key: v.string(),
  label: v.string(),
  type: templateVariableType,
  required: v.boolean(),
  description: v.union(v.string(), v.null()),
  defaultValue: v.union(templateVariableValue, v.null()),
  teamName: v.union(v.string(), v.null()),
})

export const generatedCounts = v.object({
  phases: v.number(),
  tasks: v.number(),
  labels: v.number(),
  reviewers: v.number(),
  blockers: v.number(),
  integrations: v.number(),
  resources: v.number(),
})

export const competitionTemplateSummary = v.object({
  key: v.string(),
  version: v.number(),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  variables: v.array(templateVariableDefinitionView),
})

export const templateCompetitionInput = v.object({
  name: v.string(),
  description: v.union(v.string(), v.null()),
  compDates: v.object(competitionDatesFields),
  people: v.object(competitionPeopleFields),
})

export const competitionTemplatePreviewArgs = {
  templateKey: v.string(),
  competition: templateCompetitionInput,
  variables: templateVariablesArg,
}

export const templatePreviewTask = v.object({
  key: v.string(),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  kind: v.union(v.literal("standard"), v.literal("flow")),
  dueDate: v.union(v.string(), v.null()),
  owner: v.union(v.string(), v.null()),
  assignees: v.union(v.string(), v.null()),
  reviewers: v.array(v.string()),
  labels: v.array(v.string()),
  integrationIds: v.array(v.string()),
  blockedBy: v.array(v.string()),
  subtasks: v.array(v.any()),
})

export const templatePreviewPhase = v.object({
  key: v.string(),
  name: v.string(),
  color: v.string(),
  isInitial: v.boolean(),
  tasks: v.array(templatePreviewTask),
})

export const templatePreview = v.object({
  templateKey: v.string(),
  templateVersion: v.number(),
  phases: v.array(templatePreviewPhase),
  counts: generatedCounts,
})

export type TemplateVariableValue = Infer<typeof templateVariableValue>
export type TemplateVariableType = Infer<typeof templateVariableType>
export type TemplateVariables = Record<string, TemplateVariableValue>
export type TemplatePreview = Infer<typeof templatePreview>
export type GeneratedCounts = Infer<typeof generatedCounts>
