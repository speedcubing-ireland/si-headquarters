import {
  buildTemplateVariableSchema,
  getDefaultTemplateVariableValues,
  normalizeTemplateVariableValues,
  requiredTemplateVariablesSatisfied,
  type TemplateVariableDefinition,
} from "@/features/competitions/create/template-variable-schema"
import { ZodProvider } from "@autoform/zod"
import { describe, expect, test } from "vitest"

const variables = [
  {
    key: "announcementDate",
    label: "Announcement date",
    type: "date",
    required: true,
    description: null,
    defaultValue: null,
    teamName: null,
  },
  {
    key: "certificatesLead",
    label: "Certificates lead",
    type: "user",
    required: false,
    description: null,
    defaultValue: null,
    teamName: null,
  },
  {
    key: "reviewers",
    label: "Reviewers",
    type: "users",
    required: false,
    description: null,
    defaultValue: null,
    teamName: null,
  },
] satisfies TemplateVariableDefinition[]

describe("template variable schema", () => {
  test("builds AutoForm field metadata", () => {
    const parsed = new ZodProvider(buildTemplateVariableSchema(variables))
      .parseSchema()
      .fields.map((field) => ({
        key: field.key,
        type: field.type,
        required: field.required,
      }))

    expect(parsed).toEqual([
      { key: "announcementDate", type: "date", required: true },
      { key: "certificatesLead", type: "user", required: false },
      { key: "reviewers", type: "users", required: false },
    ])
  })

  test("normalizes empty optional values for Convex", () => {
    const defaults = getDefaultTemplateVariableValues(variables)
    expect(requiredTemplateVariablesSatisfied(variables, defaults)).toBe(false)
    const withDate = { ...defaults, announcementDate: "2027-01-05" }

    expect(requiredTemplateVariablesSatisfied(variables, withDate)).toBe(true)
    expect(normalizeTemplateVariableValues(variables, withDate)).toEqual({
      announcementDate: "2027-01-05",
      certificatesLead: null,
      reviewers: [],
    })
  })
})
