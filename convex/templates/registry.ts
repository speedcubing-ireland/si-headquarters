import { TEAM_NAMES } from "@/convex/permissions/shared"
import { TASK_LABEL_CODES } from "@/convex/tasks/labels/constants"
import type { CompetitionTemplateDefinition } from "@/convex/templates/types"

const L = TASK_LABEL_CODES

export const standardCompetitionTemplate = {
  key: "standard-competition",
  version: 2,
  name: "Normal Competition",
  description: "Default template for competitions",
  initialPhaseKey: "concept",
  phases: [
    {
      key: "concept",
      name: "Concept",
      color: "gray",
      tasks: [
        {
          key: "size-and-venue-picked",
          name: "Size and venue picked",
          description: "Pick a venue and expected competitor limit",
          owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
          labels: [L.venue],
        },
        {
          key: "competition-budgeted",
          name: "Competition budgeted",
          description:
            "Budget put onto competition sheet and approved as needed",
          owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
          labels: [L.budget],
        },
      ],
    },
    {
      key: "pre-announcement",
      name: "Pre-Announcement",
      color: "red",
      tasks: [
        {
          key: "venue-booked",
          name: "Venue booked",
          description: `Confirm the venue booking:
- Ensure deposit is paid when required and logged in budget sheet
- Add booking confirmation to the competition's google drive folder`,
          owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
          reviewers: [{ type: "teamName", teamName: TEAM_NAMES.FINANCE }],
          labels: [L.venue, L.budget],
        },
        {
          key: "schedule-made",
          name: "Schedule made",
          description: `Build, review, and publish the official competition schedule:
- Design the initial schedule
- Review the events and rounds against nearby competitions
- Publish the schedule to WCA and verify cutoffs/time limits are correct`,
          owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
          reviewers: [{ type: "teamName", teamName: TEAM_NAMES.DELEGATES }],
          labels: [L.schedule],
          integrationIds: ["sheet.transfer-schedule-to-wca"],
        },
        {
          key: "sponsorship",
          name: "Sponsorship",
          description: "Secure sponsors and update sponsorship details.",
          owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
          labels: [L.sponsors],
          subtasks: [
            {
              key: "sponsor-bidding",
              name: "Sponsor bidding",
              description: "Allow sponsors to bid for this competition",
              owner: { type: "teamName", teamName: TEAM_NAMES.FINANCE },
              labels: [L.sponsors],
            },
          ],
        },
      ],
    },
    {
      key: "announced",
      name: "Announced",
      color: "sky",
      tasks: [
        {
          key: "social-media-promotion",
          name: "Social media promotion",
          description: `Publish social announcements across key channels:
- Post competition announcement in Discord and open a discussion thread
- Publish competition announcement and registration posts to social channels`,
          owner: { type: "teamName", teamName: TEAM_NAMES.SOCIAL_MEDIA },
          labels: [L.promotion],
          subtasks: [
            {
              key: "social-posts-published",
              name: "Instagram and Facebook posts published",
              description:
                "Publish competition announcement and registration posts to social channels.",
              owner: { type: "teamName", teamName: TEAM_NAMES.SOCIAL_MEDIA },
              labels: [L.promotion],
            },
          ],
        },
        {
          key: "delegates-organisers-preregistered",
          name: "Competition delegates and organisers pre-registered",
          description:
            "Ensure delegates and organisers are pre-registered on WCA before registration scales.",
          owner: { type: "teamName", teamName: TEAM_NAMES.DELEGATES },
          labels: [L.registration],
        },
        {
          key: "certificates-ready",
          name: "Certificates ready",
          description: "Design and order certificates for the competition.",
          owner: { type: "teamName", teamName: TEAM_NAMES.FINANCE },
          labels: [L.printing],
          subtasks: [
            {
              key: "certificates-designed",
              name: "Certificates designed",
              description:
                "Prepare final certificate designs for approval and print.",
              owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
              reviewers: [{ type: "teamName", teamName: TEAM_NAMES.GRAPHICS }],
              labels: [L.design, L.certificates],
              integrationIds: ["canva.certificates"],
            },
          ],
        },
        {
          key: "lanyard-designed",
          name: "Lanyard designed",
          description: "Create and approve the lanyard design for event use.",
          owner: { type: "teamName", teamName: TEAM_NAMES.GRAPHICS },
          reviewers: [{ type: "teamName", teamName: TEAM_NAMES.GRAPHICS }],
          labels: [L.design],
          integrationIds: ["canva.lanyards"],
        },
      ],
    },
    {
      key: "pre-competition",
      name: "Pre-Competition",
      color: "amber",
      tasks: [
        {
          key: "groups-and-printing",
          name: "Groups and printing done",
          description: `Finalize groups and print all required competition materials:
- Adjust the schedule based on final registrations and event load
- Generate final groups using approved grouping tools
- Print scorecards and lanyards from approved design files`,
          owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
          labels: [L.registration, L.printing],
          subtasks: [
            {
              key: "schedule-finalised",
              name: "Schedule finalised for actual registration numbers",
              description:
                "Adjust the schedule based on final registrations and event load.",
              owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
              reviewers: [{ type: "teamName", teamName: TEAM_NAMES.DELEGATES }],
              labels: [L.schedule],
            },
            {
              key: "groups-generated",
              name: "Groups generated",
              description:
                "Generate final groups using approved grouping tools.",
              owner: { type: "teamName", teamName: TEAM_NAMES.DELEGATES },
              labels: [L.registration],
            },
          ],
        },
        {
          key: "waiting-list-emailed",
          name: "Waiting list emailed and refunded",
          description:
            "Email the waiting list and process refunds for unaccepted registrations.",
          owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
          labels: [L.registration, L.budget],
        },
        {
          key: "pre-comp-email",
          name: "Pre-comp email written and sent",
          description:
            "Write and send pre-competition information email to competitors.",
          owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
          labels: [L.registration],
        },
        {
          key: "check-in-sheet",
          name: "Check-in sheet ready for registration",
          description:
            "Prepare check-in sheets for registration desk operations.",
          owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
          labels: [L.registration],
          integrationIds: ["sheet.populate-checkin"],
        },
      ],
    },
    {
      key: "post-competition",
      name: "Post-Competition",
      color: "green",
      tasks: [
        {
          key: "all-expenses-submitted",
          name: "All expenses submitted",
          description: "Collect and submit all competition-related expenses.",
          owner: { type: "teamName", teamName: TEAM_NAMES.FINANCE },
          labels: [L.budget],
        },
        {
          key: "podium-photos-posted",
          name: "Podium photos posted",
          description: "Publish podium photos after competition completion.",
          owner: { type: "teamName", teamName: TEAM_NAMES.SOCIAL_MEDIA },
          labels: [L.promotion],
        },
        {
          key: "final-budget-filled",
          name: "Final budget filled out",
          description:
            "Complete final budget reconciliation and close out finance records.",
          owner: { type: "teamName", teamName: TEAM_NAMES.FINANCE },
          labels: [L.budget],
        },
      ],
    },
    {
      key: "completed",
      name: "Completed",
      color: "gray",
    },
  ],
} as const satisfies CompetitionTemplateDefinition

export const competitionTemplates: readonly CompetitionTemplateDefinition[] = [
  standardCompetitionTemplate,
]

export function getCompetitionTemplate(key: string) {
  return competitionTemplates.find((template) => template.key === key) ?? null
}

export function toCompetitionTemplateSummary(
  template: CompetitionTemplateDefinition
) {
  return {
    key: template.key,
    version: template.version,
    name: template.name,
    description: template.description ?? null,
    variables: (template.variables ?? []).map((variable) => ({
      key: variable.key,
      label: variable.label,
      type: variable.type,
      required: variable.required ?? false,
      description: variable.description ?? null,
      defaultValue: variable.defaultValue ?? null,
      teamName: variable.teamName ?? null,
    })),
  }
}
