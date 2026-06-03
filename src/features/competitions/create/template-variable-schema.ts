import type { api } from "@/convex/_generated/api"
import type { TemplateVariableValue } from "@/convex/templates/validators"
import { fieldConfig } from "@autoform/zod"
import type { FunctionReturnType } from "convex/server"
import { z } from "zod/v3"

export type TemplateVariableDefinition = FunctionReturnType<
  typeof api.templates.queries.listCompetitionTemplates
>[number]["variables"][number]

export type TemplateVariableFormValues = Record<
  string,
  TemplateVariableValue | undefined
>

function stringField(variable: TemplateVariableDefinition) {
  const field = z.string()
  return variable.required
    ? field.min(1, `${variable.label} is required`)
    : field.optional()
}

function withFieldConfig(
  variable: TemplateVariableDefinition,
  schema: z.ZodTypeAny
) {
  return schema.superRefine(
    fieldConfig({
      label: variable.label,
      description: variable.description ?? undefined,
      fieldType: variable.type,
      customData: variable,
    })
  )
}

export function buildTemplateVariableSchema(
  variables: readonly TemplateVariableDefinition[]
) {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const variable of variables) {
    if (variable.type === "number") {
      shape[variable.key] = withFieldConfig(
        variable,
        variable.required
          ? z.coerce.number()
          : z.union([z.coerce.number(), z.literal("")]).optional()
      )
      continue
    }

    if (variable.type === "boolean") {
      shape[variable.key] = withFieldConfig(variable, z.boolean().optional())
      continue
    }

    if (variable.type === "users") {
      const field = z.array(z.string())
      shape[variable.key] = withFieldConfig(
        variable,
        variable.required
          ? field.min(1, `${variable.label} is required`)
          : field.optional()
      )
      continue
    }

    shape[variable.key] = withFieldConfig(variable, stringField(variable))
  }

  return z.object(shape)
}

export function getDefaultTemplateVariableValues(
  variables: readonly TemplateVariableDefinition[]
): TemplateVariableFormValues {
  const values: TemplateVariableFormValues = {}
  for (const variable of variables) {
    if (variable.defaultValue !== null) {
      values[variable.key] = variable.defaultValue
      continue
    }
    if (variable.type === "users") {
      values[variable.key] = []
    } else if (variable.type === "boolean") {
      values[variable.key] = false
    } else {
      values[variable.key] = ""
    }
  }
  return values
}

export function normalizeTemplateVariableValues(
  variables: readonly TemplateVariableDefinition[],
  values: TemplateVariableFormValues
): Record<string, TemplateVariableValue> {
  const normalized: Record<string, TemplateVariableValue> = {}

  for (const variable of variables) {
    const value = values[variable.key]
    if (variable.type === "users") {
      normalized[variable.key] = Array.isArray(value) ? value : []
      continue
    }
    if (variable.type === "number") {
      normalized[variable.key] =
        typeof value === "number"
          ? value
          : typeof value === "string" && value.length > 0
            ? Number(value)
            : null
      continue
    }
    if (variable.type === "boolean") {
      normalized[variable.key] = value === true
      continue
    }
    normalized[variable.key] =
      typeof value === "string" && value.length > 0 ? value : null
  }

  return normalized
}

export function requiredTemplateVariablesSatisfied(
  variables: readonly TemplateVariableDefinition[],
  values: TemplateVariableFormValues
) {
  return variables.every((variable) => {
    if (!variable.required) return true
    const value = values[variable.key]
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && value !== ""
  })
}
