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

/** Stable codes for labels used across competitions and templates. */
export const TASK_LABEL_CODES = {
  budget: "budget",
  certificates: "certificates",
  design: "design",
  printing: "printing",
  promotion: "promotion",
  registration: "registration",
  schedule: "schedule",
  sponsors: "sponsors",
  venue: "venue",
} as const

export type TaskLabelCode =
  (typeof TASK_LABEL_CODES)[keyof typeof TASK_LABEL_CODES]

export interface TaskLabelSpec {
  code: TaskLabelCode
  name: string
  color: TaskLabelColor
}

/** Canonical label definitions seeded into the database and referenced by templates. */
export const DEFAULT_TASK_LABELS = [
  {
    code: TASK_LABEL_CODES.budget,
    name: "Budget",
    color: "amber",
  },
  {
    code: TASK_LABEL_CODES.certificates,
    name: "Certificates",
    color: "sky",
  },
  {
    code: TASK_LABEL_CODES.design,
    name: "Design",
    color: "rose",
  },
  {
    code: TASK_LABEL_CODES.printing,
    name: "Printing",
    color: "sky",
  },
  {
    code: TASK_LABEL_CODES.promotion,
    name: "Promotion",
    color: "emerald",
  },
  {
    code: TASK_LABEL_CODES.registration,
    name: "Registration",
    color: "teal",
  },
  {
    code: TASK_LABEL_CODES.schedule,
    name: "Schedule",
    color: "violet",
  },
  {
    code: TASK_LABEL_CODES.sponsors,
    name: "Sponsors",
    color: "emerald",
  },
  {
    code: TASK_LABEL_CODES.venue,
    name: "Venue",
    color: "indigo",
  },
] as const satisfies readonly TaskLabelSpec[]

export const DEFAULT_TASK_LABEL_BY_CODE = Object.fromEntries(
  DEFAULT_TASK_LABELS.map((label) => [label.code, label])
) as Record<TaskLabelCode, TaskLabelSpec>

export function getDefaultTaskLabelSpec(code: TaskLabelCode): TaskLabelSpec {
  return DEFAULT_TASK_LABEL_BY_CODE[code]
}

export function getDefaultTaskLabelName(code: TaskLabelCode): string {
  return getDefaultTaskLabelSpec(code).name
}

export function normalizeTaskLabelCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
