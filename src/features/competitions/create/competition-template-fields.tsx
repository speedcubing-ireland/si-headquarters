import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { TemplateVariableFields } from "@/features/competitions/create/template-variable-fields"
import type { TemplateVariableFormValues } from "@/features/competitions/create/template-variable-schema"
import type { api } from "@/convex/_generated/api"
import type { FunctionReturnType } from "convex/server"

type CompetitionTemplateSummary = FunctionReturnType<
  typeof api.templates.queries.listCompetitionTemplates
>[number]

export function CompetitionTemplateFields({
  templates,
  activeTemplateKey,
  onTemplateKeyChange,
  variables,
  variableValues,
  onVariableValuesChange,
}: {
  templates: CompetitionTemplateSummary[] | undefined
  activeTemplateKey: string
  onTemplateKeyChange: (templateKey: string) => void
  variables: CompetitionTemplateSummary["variables"]
  variableValues: TemplateVariableFormValues
  onVariableValuesChange: (values: TemplateVariableFormValues) => void
}) {
  return (
    <>
      <NativeSelect
        value={activeTemplateKey}
        onChange={(event) => {
          onTemplateKeyChange(event.currentTarget.value)
        }}
      >
        {(templates ?? []).map((template) => (
          <NativeSelectOption key={template.key} value={template.key}>
            {template.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      {variables.length > 0 ? (
        <TemplateVariableFields
          key={activeTemplateKey}
          variables={variables}
          values={variableValues}
          onChange={onVariableValuesChange}
        />
      ) : null}
    </>
  )
}
