import { v, type Infer } from "convex/values"

export const TEAM_NAMES = {
  VOLUNTEER: "Volunteer",
  DIRECTORS: "Directors",
  COMPETITIONS: "Competitions Team",
  FINANCE: "Finance Team",
  SOCIAL_MEDIA: "Social Media Team",
  MERCH: "Merch Team",
  GRAPHICS: "Graphics Team",
  SOFTWARE: "Software Team",
  DELEGATES: "Delegates",
} as const

export type TeamName = (typeof TEAM_NAMES)[keyof typeof TEAM_NAMES]

const ALL_TEAM_NAMES: readonly string[] = Object.values(TEAM_NAMES)

export function isTeamName(teamName: string): teamName is TeamName {
  return ALL_TEAM_NAMES.includes(teamName)
}

export const teamNameValidator = v.union(
  v.literal(TEAM_NAMES.VOLUNTEER),
  v.literal(TEAM_NAMES.DIRECTORS),
  v.literal(TEAM_NAMES.COMPETITIONS),
  v.literal(TEAM_NAMES.FINANCE),
  v.literal(TEAM_NAMES.SOCIAL_MEDIA),
  v.literal(TEAM_NAMES.MERCH),
  v.literal(TEAM_NAMES.GRAPHICS),
  v.literal(TEAM_NAMES.SOFTWARE),
  v.literal(TEAM_NAMES.DELEGATES)
)

export const NON_APPLICATION_TEAM_NAMES = [
  TEAM_NAMES.VOLUNTEER,
] as const satisfies readonly TeamName[]

export const NON_APPLICATION_TEAM_NAME_SET: ReadonlySet<string> = new Set(
  NON_APPLICATION_TEAM_NAMES
)

export const actionValidator = v.union(
  v.literal("read"),
  v.literal("create"),
  v.literal("update"),
  v.literal("delete"),
  v.literal("manage"),
  v.literal("access")
)

export const subjectValidator = v.union(
  v.literal("all"),
  v.literal("Competition"),
  v.literal("Project"),
  v.literal("Task"),
  v.literal("Team"),
  v.literal("User"),
  v.literal("UserManagement"),
  v.literal("SponsorPortalAdmin"),
  v.literal("Wca2fa"),
  v.literal("SocialMediaDashboard"),
  v.literal("RefundsDashboard"),
  v.literal("EventsDashboard")
)

export const permissionValidator = v.object({
  action: actionValidator,
  subject: subjectValidator,
})

export type Action = Infer<typeof actionValidator>
export type Subject = Infer<typeof subjectValidator>
export type Permission = Infer<typeof permissionValidator>
