export const TASK_LABEL_COLORS = [
  "slate",
  "rose",
  "amber",
  "emerald",
  "teal",
  "sky",
  "indigo",
  "violet",
] as const

export type TaskLabelColor = (typeof TASK_LABEL_COLORS)[number]

export const DEFAULT_TASK_LABEL_COLOR = "slate" satisfies TaskLabelColor

export const TASK_LABEL_CODES = {
  certificates: "certificates",
  content: "content",
  design: "design",
  frontend: "frontend",
  operations: "operations",
  strategy: "strategy",
  venue: "venue",
} as const

export type TaskLabelCode =
  (typeof TASK_LABEL_CODES)[keyof typeof TASK_LABEL_CODES]

export interface TaskLabelSpec {
  code: TaskLabelCode
  name: string
  color: TaskLabelColor
}

export const DEFAULT_TASK_LABELS = [
  {
    code: TASK_LABEL_CODES.certificates,
    name: "Certificates",
    color: "sky",
  },
  {
    code: TASK_LABEL_CODES.content,
    name: "Content",
    color: "emerald",
  },
  {
    code: TASK_LABEL_CODES.design,
    name: "Design",
    color: "rose",
  },
  {
    code: TASK_LABEL_CODES.frontend,
    name: "Frontend",
    color: "teal",
  },
  {
    code: TASK_LABEL_CODES.operations,
    name: "Operations",
    color: "amber",
  },
  {
    code: TASK_LABEL_CODES.strategy,
    name: "Strategy",
    color: "violet",
  },
  {
    code: TASK_LABEL_CODES.venue,
    name: "Venue",
    color: "indigo",
  },
] as const satisfies readonly TaskLabelSpec[]

export function normalizeTaskLabelCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
