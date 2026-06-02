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

/** Teams shown in admin membership UI (excludes grant-less placeholder teams). */
export const ADMIN_ASSIGNABLE_TEAM_NAMES = [
  TEAM_NAMES.VOLUNTEER,
  TEAM_NAMES.DIRECTORS,
  TEAM_NAMES.COMPETITIONS,
  TEAM_NAMES.FINANCE,
  TEAM_NAMES.DELEGATES,
] as const satisfies readonly TeamName[]

/**
 * Teams used for permission grants or baseline membership, but not as
 * functional teams in application pickers, navigation, or task workflows.
 */
export const NON_APPLICATION_TEAM_NAMES = [
  TEAM_NAMES.VOLUNTEER,
] as const satisfies readonly TeamName[]

export const ADMIN_ASSIGNABLE_TEAM_NAME_SET: ReadonlySet<string> = new Set(
  ADMIN_ASSIGNABLE_TEAM_NAMES
)

export const NON_APPLICATION_TEAM_NAME_SET: ReadonlySet<string> = new Set(
  NON_APPLICATION_TEAM_NAMES
)

export type Action =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "manage"
  | "access"

export type Subject =
  | "all"
  | "Competition"
  | "Task"
  | "Team"
  | "User"
  | "UserManagement"
  | "SponsorPortalAdmin"

export interface Permission {
  action: Action
  subject: Subject
}
