"use client"

import type { AutoFormFieldProps } from "@autoform/react"
import { AutoForm } from "@/components/ui/autoform"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import * as UserSelector from "@/components/data-selectors/user-selector"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
  buildTemplateVariableSchema,
  type TemplateVariableDefinition,
  type TemplateVariableFormValues,
} from "@/features/competitions/create/template-variable-schema"
import { ZodProvider } from "@autoform/zod"
import { z } from "zod/v3"
import { useQuery } from "convex/react"
import { useCallback, useEffect, useMemo, useRef } from "react"
import type { UseFormReturn } from "react-hook-form"
import { useFormContext } from "react-hook-form"

const userIdValue = z.custom<Id<"users">>(
  (value) => typeof value === "string" && value.length > 0
)
const userIdsValue = userIdValue.array()

function UserVariableField({ path, value }: AutoFormFieldProps) {
  const form = useFormContext<TemplateVariableFormValues>()
  const parsed = userIdValue.safeParse(value)
  const userId = parsed.success ? parsed.data : null

  return (
    <UserSelector.SinglePropertyButton
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
  const parsed = userIdsValue.safeParse(value)
  const userIds = parsed.success ? parsed.data : []

  return (
    <UserSelector.MultiPropertyButton
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
