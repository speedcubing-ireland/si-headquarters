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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import * as DateRangeSelector from "@/features/competitions/components/date-range-selector"
import { CompetitionPeopleFormFields } from "@/features/competitions/create/competition-people-form-fields"
import { TemplatePreviewPanel } from "@/features/competitions/create/template-preview-panel"
import { TemplateVariableFields } from "@/features/competitions/create/template-variable-fields"
import {
  getDefaultTemplateVariableValues,
  normalizeTemplateVariableValues,
  requiredTemplateVariablesSatisfied,
  type TemplateVariableFormValues,
} from "@/features/competitions/create/template-variable-schema"
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
  const templates = useQuery(api.templates.queries.listCompetitionTemplates, {})
  const users = useQuery(api.users.queries.list, {})
  const createCompetition = useMutation(
    api.competitions.mutations.createFromTemplate
  )

  const [open, setOpen] = useState(false)
  const [templateKey, setTemplateKey] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [compDates, setCompDates] = useState<{
    from: string | null
    to: string | null
  }>({ from: null, to: null })
  const [compLeadId, setCompLeadId] = useState<Id<"users"> | null>(null)
  const [leadDelegateId, setLeadDelegateId] = useState<Id<"users"> | null>(null)
  const [organiserIds, setOrganiserIds] = useState<Id<"users">[]>([])
  const [variableValuesByTemplate, setVariableValuesByTemplate] = useState<
    Record<string, TemplateVariableFormValues>
  >({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

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
  const canPreview =
    selectedTemplate !== undefined &&
    name.trim().length > 0 &&
    requiredSatisfied

  const preview = useQuery(
    api.templates.queries.previewCompetitionTemplate,
    canPreview
      ? {
          templateKey: activeTemplateKey,
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
          variables: normalizedVariables,
        }
      : "skip"
  )

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

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSubmitError(null)
      setIsCreating(false)
    }
  }

  const handleCreate = async () => {
    if (selectedTemplate === undefined || isCreating) return
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

  const canSubmit =
    selectedTemplate !== undefined &&
    activeTemplateKey.length > 0 &&
    name.trim().length > 0 &&
    requiredSatisfied &&
    !isCreating

  const templateDescription = selectedTemplate?.description ?? null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            <NativeSelect
              id="competition-template"
              value={activeTemplateKey}
              onChange={(event) => {
                const nextKey = event.currentTarget.value
                setTemplateKey(nextKey)
                const nextTemplate = templates?.find(
                  (template) => template.key === nextKey
                )
                setVariableValuesByTemplate((prev) => ({
                  ...prev,
                  [nextKey]: getDefaultTemplateVariableValues(
                    nextTemplate?.variables ?? []
                  ),
                }))
              }}
            >
              {templates?.map((template) => (
                <NativeSelectOption key={template.key} value={template.key}>
                  {template.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {templateDescription !== null ? (
              <FieldDescription>{templateDescription}</FieldDescription>
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

          {variables.length > 0 ? (
            <Field>
              <FieldLabel>Template variables</FieldLabel>
              <TemplateVariableFields
                key={activeTemplateKey}
                variables={variables}
                values={variableValues}
                onChange={(values) => {
                  setVariableValuesByTemplate((prev) => ({
                    ...prev,
                    [activeTemplateKey]: values,
                  }))
                }}
              />
            </Field>
          ) : null}

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
