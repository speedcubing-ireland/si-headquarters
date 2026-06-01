export const TEAM_NAMES = {
  VOLUNTEER: "Volunteer",
  DIRECTORS: "Directors",
  COMPETITIONS: "Competitions Team",
  FINANCE: "Finance Team",
  SOCIAL_MEDIA: "Social Media Team",
  DELEGATES: "Delegates",
} as const

export type TeamName = (typeof TEAM_NAMES)[keyof typeof TEAM_NAMES]
