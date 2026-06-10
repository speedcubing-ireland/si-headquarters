import {
  getDefaultTemplateVariableValues,
  normalizeTemplateVariableValues,
  requiredTemplateVariablesSatisfied,
  type TemplateVariableFormValues,
} from "@/features/competitions/create/template-variable-schema"
import { api } from "@/convex/_generated/api"
import type { TemplateCompetitionInput } from "@/convex/templates/types"
import type { TemplateVariables } from "@/convex/templates/validators"
import { useQuery } from "convex/react"
import { useMemo, useState } from "react"

export function useCompetitionTemplateSelection() {
  const templates = useQuery(api.templates.queries.listCompetitionTemplates, {})
  const [templateKey, setTemplateKey] = useState("")
  const [variableValuesByTemplate, setVariableValuesByTemplate] = useState<
    Record<string, TemplateVariableFormValues>
  >({})

  const activeTemplateKey =
    templateKey.length > 0 ? templateKey : (templates?.[0]?.key ?? "")
  const selectedTemplate = templates?.find(
    (template) => template.key === activeTemplateKey
  )
  const variables = useMemo(
    () => selectedTemplate?.variables ?? [],
    [selectedTemplate]
  )
  const variableValues =
    variableValuesByTemplate[activeTemplateKey] ??
    getDefaultTemplateVariableValues(variables)
  const normalizedVariables = useMemo(
    () => normalizeTemplateVariableValues(variables, variableValues),
    [variableValues, variables]
  )
  const requiredSatisfied = requiredTemplateVariablesSatisfied(
    variables,
    variableValues
  )

  function selectTemplateKey(nextKey: string) {
    setTemplateKey(nextKey)
    setVariableValuesByTemplate((current) => {
      if (nextKey in current) {
        return current
      }
      const nextTemplate = templates?.find(
        (template) => template.key === nextKey
      )
      return {
        ...current,
        [nextKey]: getDefaultTemplateVariableValues(
          nextTemplate?.variables ?? []
        ),
      }
    })
  }

  function setVariableValues(nextValues: TemplateVariableFormValues) {
    setVariableValuesByTemplate((current) => ({
      ...current,
      [activeTemplateKey]: nextValues,
    }))
  }

  return {
    templates,
    activeTemplateKey,
    selectTemplateKey,
    selectedTemplate,
    variables,
    variableValues,
    setVariableValues,
    normalizedVariables,
    requiredSatisfied,
  }
}

export function useCompetitionTemplatePreview({
  activeTemplateKey,
  competition,
  enabled,
  normalizedVariables,
}: {
  activeTemplateKey: string
  competition: TemplateCompetitionInput
  enabled: boolean
  normalizedVariables: TemplateVariables
}) {
  return useQuery(
    api.templates.queries.previewCompetitionTemplate,
    enabled
      ? {
          templateKey: activeTemplateKey,
          competition,
          variables: normalizedVariables,
        }
      : "skip"
  )
}
