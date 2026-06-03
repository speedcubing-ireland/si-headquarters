"use client"

import {
  AutoForm as BaseAutoForm,
  buildZodFieldConfig,
  type AutoFormFieldComponents,
  type AutoFormFieldProps,
  type AutoFormUIComponents,
  type ExtendableAutoFormProps,
  type FieldWrapperProps,
} from "@autoform/react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type * as React from "react"
import type { FieldValues } from "react-hook-form"
import { useFormContext } from "react-hook-form"

function renderRenderable(value: FieldWrapperProps["label"]) {
  if (value === false || value === null || value === undefined) return null
  return value
}

function Form({
  children,
  className,
  onSubmit: _onSubmit,
  ref: _ref,
}: React.ComponentProps<"form">) {
  return <div className={cn("grid gap-4", className)}>{children}</div>
}

function FieldWrapper({ children, error, field, id, label }: FieldWrapperProps) {
  const description = renderRenderable(field.description)

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{renderRenderable(label)}</FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}

function ErrorMessage({ error }: { error: string }) {
  return <FieldError>{error}</FieldError>
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return <Button type="submit">{children}</Button>
}

function ObjectWrapper({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4">{children}</div>
}

function ArrayWrapper({
  children,
  onAddItem,
}: {
  children: React.ReactNode
  onAddItem: () => void
}) {
  return (
    <div className="grid gap-3">
      {children}
      <Button type="button" variant="outline" size="sm" onClick={onAddItem}>
        Add
      </Button>
    </div>
  )
}

function ArrayElementWrapper({
  children,
  onRemove,
}: {
  children: React.ReactNode
  onRemove: () => void
}) {
  return (
    <div className="grid gap-2 rounded-lg border p-3">
      {children}
      <Button type="button" variant="outline" size="sm" onClick={onRemove}>
        Remove
      </Button>
    </div>
  )
}

function TextField({ id, inputProps }: AutoFormFieldProps) {
  return <Input id={id} {...inputProps} />
}

function NumberField({ id, inputProps }: AutoFormFieldProps) {
  return <Input id={id} type="number" {...inputProps} />
}

function DateField({ id, inputProps }: AutoFormFieldProps) {
  return <Input id={id} type="date" {...inputProps} />
}

function BooleanField({ id, path, value }: AutoFormFieldProps) {
  const form = useFormContext()
  const fieldName = path.join(".")

  return (
    <Checkbox
      id={id}
      checked={value === true}
      onCheckedChange={(checked) => {
        form.setValue(fieldName, checked === true, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        })
      }}
    />
  )
}

const defaultUiComponents = {
  Form,
  FieldWrapper,
  ErrorMessage,
  SubmitButton,
  ObjectWrapper,
  ArrayWrapper,
  ArrayElementWrapper,
} satisfies AutoFormUIComponents

const defaultFormComponents = {
  string: TextField,
  number: NumberField,
  date: DateField,
  boolean: BooleanField,
  fallback: TextField,
} satisfies AutoFormFieldComponents

export function AutoForm<T extends FieldValues>({
  formComponents,
  uiComponents,
  ...props
}: ExtendableAutoFormProps<T>) {
  return (
    <BaseAutoForm
      {...props}
      uiComponents={{ ...defaultUiComponents, ...uiComponents }}
      formComponents={{ ...defaultFormComponents, ...formComponents }}
    />
  )
}

export { buildZodFieldConfig }
export type { AutoFormFieldProps }
