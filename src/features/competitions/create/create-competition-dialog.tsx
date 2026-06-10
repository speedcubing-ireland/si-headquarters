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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import * as DateRangeSelector from "@/features/competitions/components/date-range-selector"
import { CompetitionPeopleFormFields } from "@/features/competitions/create/competition-people-form-fields"
import { CompetitionTemplateFields } from "@/features/competitions/create/competition-template-fields"
import { TemplatePreviewPanel } from "@/features/competitions/create/template-preview-panel"
import {
  useCompetitionTemplatePreview,
  useCompetitionTemplateSelection,
} from "@/features/competitions/create/use-competition-template-selection"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import { LoaderCircleIcon, PlusIcon } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import { useMemo, useState, type ComponentProps, type ReactNode } from "react"

export function CreateCompetitionDialog({
  children,
}: {
  children?: ReactNode
}) {
  const navigate = useNavigate()
  const users = useQuery(api.users.queries.list, {})
  const createCompetition = useMutation(
    api.competitions.mutations.createFromTemplate
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

  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [compDates, setCompDates] = useState<{
    from: string | null
    to: string | null
  }>({ from: null, to: null })
  const [compLeadId, setCompLeadId] = useState<Id<"users"> | null>(null)
  const [leadDelegateId, setLeadDelegateId] = useState<Id<"users"> | null>(null)
  const [organiserIds, setOrganiserIds] = useState<Id<"users">[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const canPreview =
    selectedTemplate !== undefined &&
    name.trim().length > 0 &&
    requiredSatisfied
  const preview = useCompetitionTemplatePreview({
    activeTemplateKey,
    competition: {
      name,
      description: description.trim() || null,
      compDates,
      people: {
        compLead: compLeadId,
        leadDelegate: leadDelegateId,
        organisers: organiserIds,
      },
    },
    enabled: canPreview,
    normalizedVariables,
  })

  const userById = useMemo(
    () => new Map(users?.map((user) => [user._id, user]) ?? []),
    [users]
  )
  const compLead = compLeadId ? (userById.get(compLeadId) ?? null) : null
  const leadDelegate = leadDelegateId
    ? (userById.get(leadDelegateId) ?? null)
    : null
  const organisers = organiserIds
    .map((id) => userById.get(id))
    .filter((user): user is NonNullable<typeof user> => user !== undefined)

  const canSubmit =
    selectedTemplate !== undefined &&
    activeTemplateKey.length > 0 &&
    name.trim().length > 0 &&
    requiredSatisfied &&
    !isCreating

  async function handleCreate() {
    if (!canSubmit) return
    setIsCreating(true)
    setSubmitError(null)
    try {
      const competitionId = await createCompetition({
        templateKey: activeTemplateKey,
        name,
        description: description.trim() || null,
        compDates,
        people: {
          compLead: compLeadId,
          leadDelegate: leadDelegateId,
          organisers: organiserIds,
        },
        variables: normalizedVariables,
      })
      setOpen(false)
      await navigate({
        to: "/competitions/$id",
        params: { id: competitionId },
      })
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not create competition."
      )
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setSubmitError(null)
          setIsCreating(false)
        }
      }}
    >
      <DialogTrigger asChild>
        {children ?? (
          <Button type="button">
            <PlusIcon />
            New Competition
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[min(92vh,760px)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New competition</DialogTitle>
          <DialogDescription>
            Create a competition with phases and tasks from a template.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="competition-template">Template</FieldLabel>
            <CompetitionTemplateFields
              templates={templates}
              activeTemplateKey={activeTemplateKey}
              onTemplateKeyChange={selectTemplateKey}
              variables={variables}
              variableValues={variableValues}
              onVariableValuesChange={setVariableValues}
            />
            {selectedTemplate?.description !== undefined &&
            selectedTemplate.description !== null ? (
              <FieldDescription>
                {selectedTemplate.description}
              </FieldDescription>
            ) : null}
          </Field>

          <div className="grid gap-4 @md/main:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="competition-name">Name</FieldLabel>
              <Input
                id="competition-name"
                value={name}
                onChange={(event) => {
                  setName(event.currentTarget.value)
                }}
              />
            </Field>
            <Field>
              <FieldLabel>Dates</FieldLabel>
              <DateRangeSelector.Button
                value={compDates}
                onChange={setCompDates}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="competition-description">
              Description
            </FieldLabel>
            <Textarea
              id="competition-description"
              value={description}
              onChange={(event) => {
                setDescription(event.currentTarget.value)
              }}
            />
          </Field>

          <CompetitionPeopleFormFields
            compLead={compLead}
            leadDelegate={leadDelegate}
            organisers={organisers}
            compLeadId={compLeadId}
            leadDelegateId={leadDelegateId}
            organiserIds={organiserIds}
            onCompLeadChange={setCompLeadId}
            onLeadDelegateChange={setLeadDelegateId}
            onOrganisersChange={setOrganiserIds}
          />

          {canPreview ? (
            <TemplatePreviewPanel preview={preview} />
          ) : (
            <FieldDescription>
              Enter the required competition details to preview generated work.
            </FieldDescription>
          )}

          {submitError !== null ? <FieldError>{submitError}</FieldError> : null}
        </FieldGroup>

        <DialogFooter>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              void handleCreate()
            }}
          >
            {isCreating ? <LoaderCircleIcon className="animate-spin" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type CreateCompetitionDialogProps = ComponentProps<
  typeof CreateCompetitionDialog
>
