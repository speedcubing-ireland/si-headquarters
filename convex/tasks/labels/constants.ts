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

export const DEFAULT_TASK_LABEL_BY_CODE = {
  [TASK_LABEL_CODES.budget]: {
    code: TASK_LABEL_CODES.budget,
    name: "Budget",
    color: "amber",
  },
  [TASK_LABEL_CODES.certificates]: {
    code: TASK_LABEL_CODES.certificates,
    name: "Certificates",
    color: "sky",
  },
  [TASK_LABEL_CODES.design]: {
    code: TASK_LABEL_CODES.design,
    name: "Design",
    color: "rose",
  },
  [TASK_LABEL_CODES.printing]: {
    code: TASK_LABEL_CODES.printing,
    name: "Printing",
    color: "sky",
  },
  [TASK_LABEL_CODES.promotion]: {
    code: TASK_LABEL_CODES.promotion,
    name: "Promotion",
    color: "emerald",
  },
  [TASK_LABEL_CODES.registration]: {
    code: TASK_LABEL_CODES.registration,
    name: "Registration",
    color: "teal",
  },
  [TASK_LABEL_CODES.schedule]: {
    code: TASK_LABEL_CODES.schedule,
    name: "Schedule",
    color: "violet",
  },
  [TASK_LABEL_CODES.sponsors]: {
    code: TASK_LABEL_CODES.sponsors,
    name: "Sponsors",
    color: "emerald",
  },
  [TASK_LABEL_CODES.venue]: {
    code: TASK_LABEL_CODES.venue,
    name: "Venue",
    color: "indigo",
  },
} as const satisfies Record<TaskLabelCode, TaskLabelSpec>

export const DEFAULT_TASK_LABELS = Object.values(DEFAULT_TASK_LABEL_BY_CODE)

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
