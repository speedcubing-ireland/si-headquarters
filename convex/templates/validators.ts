import { v, type Infer } from "convex/values"

export const templateVariableValue = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.null(),
  v.array(v.string())
)

export const templateVariablesArg = v.record(v.string(), templateVariableValue)

export type TemplateVariableValue = Infer<typeof templateVariableValue>
export type TemplateVariables = Record<string, TemplateVariableValue>
