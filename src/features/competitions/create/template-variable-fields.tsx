"use client"

import type { AutoFormFieldProps } from "@/components/ui/autoform"
import { AutoForm } from "@/components/ui/autoform"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import * as UserSelector from "@/components/data-selectors/user-selector"
import { api } from "@/convex/_generated/api"
import {
  buildTemplateVariableSchema,
  type TemplateVariableDefinition,
  type TemplateVariableFormValues,
} from "@/features/competitions/create/template-variable-schema"
import { ZodProvider } from "@autoform/zod"
import { useQuery } from "convex/react"
import { useCallback, useEffect, useMemo, useRef } from "react"
import type { UseFormReturn } from "react-hook-form"
import { useFormContext } from "react-hook-form"

function UserVariableField({ path, value }: AutoFormFieldProps) {
  const form = useFormContext<TemplateVariableFormValues>()
  const users = useQuery(api.users.queries.list, {})
  const rawUserId = typeof value === "string" ? value : ""
  const selectedUser =
    users?.find((user) => user._id === rawUserId) ?? null
  const userId = selectedUser?._id ?? null

  return (
    <UserSelector.SinglePropertyButton
      selectedUser={selectedUser}
      value={userId}
      onChange={(nextUserId) => {
        form.setValue(path.join("."), nextUserId ?? "", {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        })
      }}
    />
  )
}

function UsersVariableField({ path, value }: AutoFormFieldProps) {
  const form = useFormContext<TemplateVariableFormValues>()
  const rawUserIds = Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.length > 0
      )
    : []
  const users = useQuery(api.users.queries.list, {})
  const userById = new Map(users?.map((user) => [user._id, user]) ?? [])
  const selectedUsers = rawUserIds
    .map((id) => userById.get(id))
    .filter((user): user is NonNullable<typeof user> => user !== undefined)
  const userIds = selectedUsers.map((user) => user._id)

  return (
    <UserSelector.MultiPropertyButton
      selectedUsers={selectedUsers}
      value={userIds}
      onChange={(nextUserIds) => {
        form.setValue(path.join("."), nextUserIds, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        })
      }}
    />
  )
}

function TeamVariableField({ id, path, value }: AutoFormFieldProps) {
  const form = useFormContext<TemplateVariableFormValues>()
  const teams = useQuery(api.teams.queries.listForTaskFilters, {})
  const selected = typeof value === "string" ? value : ""

  return (
    <NativeSelect
      id={id}
      value={selected}
      onChange={(event) => {
        form.setValue(path.join("."), event.currentTarget.value, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        })
      }}
    >
      <NativeSelectOption value="">None</NativeSelectOption>
      {teams?.map((team) => (
        <NativeSelectOption key={team._id} value={team.name}>
          {team.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}

export function TemplateVariableFields({
  onChange,
  values,
  variables,
}: {
  onChange: (values: TemplateVariableFormValues) => void
  values: TemplateVariableFormValues
  variables: readonly TemplateVariableDefinition[]
}) {
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const schema = useMemo(
    () => new ZodProvider(buildTemplateVariableSchema(variables)),
    [variables]
  )
  const handleFormInit = useCallback(
    (form: UseFormReturn<TemplateVariableFormValues>) => {
      unsubscribeRef.current?.()
      const subscription = form.watch(() => {
        onChange(form.getValues())
      })
      unsubscribeRef.current = () => {
        subscription.unsubscribe()
      }
    },
    [onChange]
  )

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.()
    }
  }, [])

  if (variables.length === 0) return null

  return (
    <AutoForm
      schema={schema}
      values={values}
      onFormInit={handleFormInit}
      formComponents={{
        user: UserVariableField,
        users: UsersVariableField,
        team: TeamVariableField,
      }}
    />
  )
}
