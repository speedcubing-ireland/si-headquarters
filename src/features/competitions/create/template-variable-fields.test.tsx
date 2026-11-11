import { expect, test, vi } from "vitest"
import { createElement, type ComponentType } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { TemplateVariableValue } from "@/convex/templates/validators"
import { TemplateVariableFields } from "./template-variable-fields"

const state = vi.hoisted(() => ({
  multipleValue: [] as string[],
  singleValue: null as string | null,
  change: undefined as ((ids: string[]) => void) | undefined,
  setValue: vi.fn(),
}))

vi.mock("react-hook-form", () => ({
  useFormContext: () => ({ setValue: state.setValue }),
}))
vi.mock("@/components/ui/autoform", () => ({
  AutoForm: ({
    formComponents,
    values,
  }: {
    formComponents: Record<
      string,
      ComponentType<{ path: string[]; value: TemplateVariableValue }>
    >
    values: { people: TemplateVariableValue }
  }) =>
    createElement(
      formComponents[Array.isArray(values.people) ? "users" : "user"],
      { path: ["people"], value: values.people }
    ),
}))
// The picker owns label loading. Fields must pass raw form IDs regardless of
// whether the picker has resolved any of those records yet.
vi.mock("@/components/data-selectors/user-selector", () => ({
  MultiPropertyButton: ({
    value,
    onChange,
  }: {
    value: string[]
    onChange: (ids: string[]) => void
  }) => {
    state.multipleValue = value
    state.change = onChange
    return null
  },
  SinglePropertyButton: ({ value }: { value: string | null }) => {
    state.singleValue = value
    return null
  },
}))

function renderField(people: string | string[]) {
  renderToStaticMarkup(
    createElement(TemplateVariableFields, {
      values: { people },
      variables: [
        {
          key: "people",
          label: "People",
          type: Array.isArray(people) ? "users" : "user",
          required: false,
          defaultValue: null,
          description: null,
          teamName: null,
        },
      ],
      onChange: vi.fn(),
    })
  )
}

test("adding a second user preserves the first before labels have loaded", () => {
  renderField(["alice"])
  expect(state.multipleValue).toEqual(["alice"])
  state.change?.([...state.multipleValue, "ben"])
  expect(state.setValue).toHaveBeenCalledWith(
    "people",
    ["alice", "ben"],
    expect.any(Object)
  )
})

test("a single user value does not become empty while its label loads", () => {
  renderField("alice")
  expect(state.singleValue).toBe("alice")
})
