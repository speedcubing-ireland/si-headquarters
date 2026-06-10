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
import { CompetitionTemplateFields } from "@/features/competitions/create/competition-template-fields"
import { TemplatePreviewPanel } from "@/features/competitions/create/template-preview-panel"
import {
  useCompetitionTemplatePreview,
  useCompetitionTemplateSelection,
} from "@/features/competitions/create/use-competition-template-selection"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import { LayoutTemplateIcon, LoaderCircleIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export function ApplyCompetitionTemplateDialog({
  competitionId,
}: {
  competitionId: Id<"competitions">
}) {
  const applicationState = useQuery(api.templates.queries.getApplicationState, {
    competitionId,
  })
  const competition = useQuery(api.competitions.queries.getPageRoot, {
    id: competitionId,
  })
  const applyTemplate = useMutation(
    api.competitions.mutations.applyTemplateToExisting
  )
  const {
    templates,
    activeTemplateKey,
    selectTemplateKey,
    selectedTemplate,
    variables,
    variableValues,
    setVariableValues,
    normalizedVariables,
    requiredSatisfied,
  } = useCompetitionTemplateSelection()
  const preview = useCompetitionTemplatePreview({
    activeTemplateKey,
    competition: {
      name: competition?.name ?? "",
      description: competition?.description ?? null,
      compDates: competition?.compDates ?? { from: null, to: null },
      people: competition?.people ?? {
        compLead: null,
        leadDelegate: null,
        organisers: [],
      },
    },
    enabled:
      selectedTemplate !== undefined &&
      requiredSatisfied &&
      competition !== undefined &&
      competition !== null,
    normalizedVariables,
  })

  const [open, setOpen] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  if (
    applicationState === undefined ||
    !applicationState.canApply ||
    competition === undefined ||
    competition === null
  ) {
    return null
  }

  const canSubmit =
    selectedTemplate !== undefined &&
    activeTemplateKey.length > 0 &&
    requiredSatisfied &&
    !isApplying

  async function handleApply() {
    if (!canSubmit) return
    setIsApplying(true)
    try {
      await applyTemplate({
        competitionId,
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

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setIsApplying(false)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <LayoutTemplateIcon data-icon="inline-start" />
          Apply template
        </Button>
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
          <CompetitionTemplateFields
            templates={templates}
            activeTemplateKey={activeTemplateKey}
            onTemplateKeyChange={selectTemplateKey}
            variables={variables}
            variableValues={variableValues}
            onVariableValuesChange={setVariableValues}
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
