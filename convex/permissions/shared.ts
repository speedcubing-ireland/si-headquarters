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
