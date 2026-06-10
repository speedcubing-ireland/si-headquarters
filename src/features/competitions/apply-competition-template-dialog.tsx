"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { TemplatePreviewPanel } from "@/features/competitions/create/template-preview-panel"
import { TemplateVariableFields } from "@/features/competitions/create/template-variable-fields"
import {
  getDefaultTemplateVariableValues,
  normalizeTemplateVariableValues,
  requiredTemplateVariablesSatisfied,
  type TemplateVariableFormValues,
} from "@/features/competitions/create/template-variable-schema"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import { LayoutTemplateIcon, LoaderCircleIcon } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"

export function ApplyCompetitionTemplateDialog({
  competition,
  children,
}: {
  competition: Doc<"competitions">
  children?: ReactNode
}) {
  const templates = useQuery(api.templates.queries.listCompetitionTemplates, {})
  const applyTemplate = useMutation(
    api.competitions.mutations.applyTemplateToExisting
  )

  const [open, setOpen] = useState(false)
  const [templateKey, setTemplateKey] = useState("")
  const [variableValuesByTemplate, setVariableValuesByTemplate] = useState<
    Record<string, TemplateVariableFormValues>
  >({})
  const [isApplying, setIsApplying] = useState(false)

  const defaultTemplateKey = templates?.[0]?.key ?? ""
  const activeTemplateKey =
    templateKey.length > 0 ? templateKey : defaultTemplateKey
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
  const canPreview = selectedTemplate !== undefined && requiredSatisfied

  const preview = useQuery(
    api.templates.queries.previewCompetitionTemplate,
    canPreview
      ? {
          templateKey: activeTemplateKey,
          competition: {
            name: competition.name,
            description: competition.description,
            compDates: competition.compDates,
            people: competition.people,
          },
          variables: normalizedVariables,
        }
      : "skip"
  )

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setIsApplying(false)
    }
  }

  const handleApply = async () => {
    if (selectedTemplate === undefined || isApplying) return
    setIsApplying(true)
    try {
      await applyTemplate({
        competitionId: competition._id,
        templateKey: activeTemplateKey,
        variables: normalizedVariables,
      })
      toast.success("Competition template applied.")
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not apply competition template."
      )
    } finally {
      setIsApplying(false)
    }
  }

  const canSubmit =
    selectedTemplate !== undefined &&
    activeTemplateKey.length > 0 &&
    requiredSatisfied &&
    !isApplying

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children ?? (
          <Button type="button" variant="outline" size="sm">
            <LayoutTemplateIcon data-icon="inline-start" />
            Apply template
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Apply competition template</DialogTitle>
          <DialogDescription>
            Add phases and tasks from a template to {competition.name}. This
            keeps the same competition record, including any linked sponsorship
            auction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <NativeSelect
            value={activeTemplateKey}
            onChange={(event) => {
              setTemplateKey(event.target.value)
            }}
          >
            {(templates ?? []).map((template) => (
              <NativeSelectOption key={template.key} value={template.key}>
                {template.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <TemplateVariableFields
            variables={variables}
            values={variableValues}
            onChange={(nextValues) => {
              setVariableValuesByTemplate((current) => ({
                ...current,
                [activeTemplateKey]: nextValues,
              }))
            }}
          />

          {preview ? <TemplatePreviewPanel preview={preview} /> : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => void handleApply()}
            disabled={!canSubmit}
          >
            {isApplying ? (
              <>
                <LoaderCircleIcon
                  data-icon="inline-start"
                  className="animate-spin"
                />
                Applying…
              </>
            ) : (
              "Apply template"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ApplyCompetitionTemplateButton({
  competitionId,
}: {
  competitionId: Id<"competitions">
}) {
  const templateState = useQuery(
    api.competitions.queries.getTemplateApplicationState,
    { id: competitionId }
  )
  const competition = useQuery(api.competitions.queries.getPageRoot, {
    id: competitionId,
  })

  if (
    templateState === undefined ||
    !templateState.canApply ||
    competition === undefined ||
    competition === null
  ) {
    return null
  }

  return <ApplyCompetitionTemplateDialog competition={competition} />
}
