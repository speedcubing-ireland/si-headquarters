"use client"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ResponsiveModal } from "@/components/ui/responsive-modal"
import { Textarea } from "@/components/ui/textarea"
import * as DateRangeSelector from "@/features/competitions/components/date-range-selector"
import { CompetitionPeopleFormFields } from "@/features/competitions/create/competition-people-form-fields"
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
  const [variableValuesByTemplate, setVariableValuesByTemplate] = useState<
    Record<string, TemplateVariableFormValues>
  >({})
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
    <ResponsiveModal.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setSubmitError(null)
          setIsCreating(false)
        }
      }}
    >
      <ResponsiveModal.Trigger asChild>
        {children ?? (
          <Button type="button">
            <PlusIcon />
            New Competition
          </Button>
        )}
      </ResponsiveModal.Trigger>
      <ResponsiveModal.Content desktopClassName="sm:max-w-2xl">
        <ResponsiveModal.Form
          onSubmit={(event) => {
            event.preventDefault()
            void handleCreate()
          }}
        >
          <ResponsiveModal.Header>
            <ResponsiveModal.Title>New competition</ResponsiveModal.Title>
            <ResponsiveModal.Description>
              Create a competition from a template.
            </ResponsiveModal.Description>
          </ResponsiveModal.Header>

          <ResponsiveModal.Body>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="competition-template">Template</FieldLabel>
                <NativeSelect
                  id="competition-template"
                  value={activeTemplateKey}
                  disabled={isCreating}
                  onChange={(event) => {
                    selectTemplateKey(event.currentTarget.value)
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
                    onChange={(nextValues) => {
                      setVariableValuesByTemplate((current) => ({
                        ...current,
                        [activeTemplateKey]: nextValues,
                      }))
                    }}
                  />
                ) : null}
                {selectedTemplate?.description !== undefined &&
                selectedTemplate.description !== null ? (
                  <FieldDescription>
                    {selectedTemplate.description}
                  </FieldDescription>
                ) : null}
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="competition-name">Name</FieldLabel>
                  <Input
                    id="competition-name"
                    value={name}
                    disabled={isCreating}
                    autoFocus
                    required
                    onChange={(event) => {
                      setName(event.currentTarget.value)
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel>Dates</FieldLabel>
                  <DateRangeSelector.Button
                    className="w-full"
                    value={compDates}
                    disabled={isCreating}
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
                  disabled={isCreating}
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
                disabled={isCreating}
                onCompLeadChange={setCompLeadId}
                onLeadDelegateChange={setLeadDelegateId}
                onOrganisersChange={setOrganiserIds}
              />

              {submitError !== null ? (
                <FieldError>{submitError}</FieldError>
              ) : null}
            </FieldGroup>
          </ResponsiveModal.Body>

          <ResponsiveModal.Footer>
            <ResponsiveModal.Close asChild>
              <Button type="button" variant="outline" disabled={isCreating}>
                Cancel
              </Button>
            </ResponsiveModal.Close>
            <Button type="submit" disabled={!canSubmit}>
              {isCreating ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : null}
              Create
            </Button>
          </ResponsiveModal.Footer>
        </ResponsiveModal.Form>
      </ResponsiveModal.Content>
    </ResponsiveModal.Root>
  )
}

export type CreateCompetitionDialogProps = ComponentProps<
  typeof CreateCompetitionDialog
>
