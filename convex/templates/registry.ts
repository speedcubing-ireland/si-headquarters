import { TEAM_NAMES } from "@/convex/permissions/shared"
import { TASK_LABEL_CODES } from "@/convex/tasks/labels/constants"
import type { CompetitionTemplateDefinition } from "@/convex/templates/types"

const L = TASK_LABEL_CODES

export const standardCompetitionTemplate = {
  key: "standard-competition",
  version: 4,
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
          kind: "flow",
          owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
          reviewers: [{ type: "teamName", teamName: TEAM_NAMES.FINANCE }],
          labels: [L.venue],
          subtasks: [
            {
              key: "venue-booking-confirmed",
              name: "Venue Booking Confirmed",
              description:
                "Confirm the venue booking and add confirmation to the competition's google drive folder.",
              owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
            },
            {
              key: "deposit-paid-and-logged",
              name: "Deposit paid and logged",
              description:
                "Ensure deposit is paid when required and logged in budget sheet.",
              owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
              labels: [L.budget],
            },
          ],
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
          kind: "flow",
          owner: { type: "teamName", teamName: TEAM_NAMES.FINANCE },
          labels: [L.sponsors],
          blockedBy: ["venue-booked", "schedule-made"],
          subtasks: [
            {
              key: "sponsor-bidding-complete",
              name: "Bidding Complete and Budget Updated",
              description:
                "Complete sponsor bidding and update the competition budget.",
              owner: { type: "teamName", teamName: TEAM_NAMES.FINANCE },
              labels: [L.budget],
            },
            {
              key: "wca-page-updated",
              name: "WCA Page updated",
              description:
                "Update the WCA competition page with sponsorship details.",
              assignees: { type: "competitionRole", role: "compLead" },
            },
          ],
        },
        {
          key: "submit-competition",
          name: "Submit competition",
          description:
            "Run preflight checks and submit the competition on WCA.",
          kind: "flow",
          owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
          subtasks: [
            {
              key: "prepare-for-announcement",
              name: "Check through tasks",
              description:
                "Check through tasks to make sure they are all complete and ready for announcement.",
              owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
            },
            {
              key: "preflight-checks",
              name: "Preflight checks",
              description: "Run preflight checks before submitting on WCA.",
              owner: { type: "teamName", teamName: TEAM_NAMES.DELEGATES },
            },
            {
              key: "prepare-social-media",
              name: "Prepare social media",
              description:
                "Prepare social media assets and copy for the competition announcement.",
              owner: { type: "teamName", teamName: TEAM_NAMES.SOCIAL_MEDIA },
              assignees: "assignable",
            },
            {
              key: "submit-on-wca",
              name: "Submit on WCA",
              description: "Submit the competition on the WCA website.",
              owner: { type: "teamName", teamName: TEAM_NAMES.DELEGATES },
              assignees: { type: "competitionRole", role: "leadDelegate" },
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
          assignees: "assignable",
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
            {
              key: "discord-thread-made",
              name: "Discord Thread Made",
              description:
                "Post competition announcement in Discord and open a discussion thread.",
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
          key: "podium-certificates",
          name: "Podium Certificates",
          description: "Design and order certificates for the competition.",
          kind: "flow",
          owner: { type: "teamName", teamName: TEAM_NAMES.FINANCE },
          labels: [L.certificates],
          subtasks: [
            {
              key: "design-certificate",
              name: "Design Certificate",
              description:
                "Prepare final certificate designs for approval and print.",
              owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
              reviewers: [{ type: "teamName", teamName: TEAM_NAMES.GRAPHICS }],
              labels: [L.design],
              integrationIds: ["canva.certificates"],
            },
            {
              key: "certificates-ordered",
              name: "Certificates Ordered",
              description: "Order certificates for the competition.",
              owner: { type: "teamName", teamName: TEAM_NAMES.FINANCE },
              labels: [L.printing],
            },
          ],
        },
      ],
    },
    {
      key: "pre-competition",
      name: "Pre-Competition",
      color: "amber",
      tasks: [
        {
          key: "waiting-list-emailed",
          name: "Waiting list emailed and refunded",
          description:
            "Email the waiting list and process refunds for unaccepted registrations.",
          owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
          labels: [L.registration],
        },
        {
          key: "groups-ready",
          name: "Groups Ready",
          description: `Finalize groups and prepare registration materials:
- Adjust the schedule based on final registrations and event load
- Generate final groups using approved grouping tools
- Prepare check-in sheets for registration desk operations`,
          kind: "flow",
          owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
          labels: [L.registration],
          subtasks: [
            {
              key: "schedule-finalised",
              name: "Schedule finalised for registration numbers",
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
            {
              key: "check-in-sheet-ready",
              name: "Check-in sheet ready",
              description:
                "Prepare check-in sheets for registration desk operations.",
              owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
              labels: [L.registration],
              integrationIds: ["sheet.populate-checkin"],
            },
          ],
        },
        {
          key: "printing-complete",
          name: "Printing Complete",
          description: `Print all required competition materials:
- Design and print lanyards from approved design files
- Print scorecards
- Make badges`,
          owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
          labels: [L.printing],
          blockedBy: ["groups-ready"],
          subtasks: [
            {
              key: "lanyards-designed",
              name: "Lanyards designed",
              description:
                "Create and approve the lanyard design for event use.",
              owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
              labels: [L.design],
              integrationIds: ["canva.lanyards"],
            },
            {
              key: "lanyards-printed",
              name: "Lanyards printed",
              description: "Print lanyards from approved design files.",
              owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
              labels: [L.printing],
            },
            {
              key: "scorecards-printed",
              name: "Scorecards printed",
              description: "Print scorecards for the competition.",
              owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
              labels: [L.printing],
            },
            {
              key: "badges-made",
              name: "Badges made",
              description: "Make badges for the competition.",
              owner: { type: "teamName", teamName: TEAM_NAMES.MERCH },
              labels: [L.printing],
            },
          ],
        },
        {
          key: "pre-comp-email",
          name: "Pre-comp email written and sent",
          description:
            "Write and send pre-competition information email to competitors.",
          owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
          labels: [L.registration],
          blockedBy: ["groups-ready"],
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
          key: "report-submitted",
          name: "Report submitted",
          description: "Submit the competition report on WCA.",
          owner: { type: "teamName", teamName: TEAM_NAMES.DELEGATES },
          assignees: { type: "competitionRole", role: "leadDelegate" },
        },
        {
          key: "post-comp-social-media",
          name: "Post-Competition Social Media",
          description: "Publish post-competition photos across key channels.",
          kind: "flow",
          owner: { type: "teamName", teamName: TEAM_NAMES.SOCIAL_MEDIA },
          labels: [L.promotion],
          subtasks: [
            {
              key: "podium-photos-discord",
              name: "Podium photos in Discord",
              description:
                "Share podium photos in the competition Discord thread.",
              owner: { type: "teamName", teamName: TEAM_NAMES.COMPETITIONS },
              assignees: "assignable",
              labels: [L.promotion],
            },
            {
              key: "podium-competition-photos-posted",
              name: "Podium and Competition photos posted",
              description:
                "Publish podium and competition photos to social channels.",
              owner: { type: "teamName", teamName: TEAM_NAMES.SOCIAL_MEDIA },
              assignees: "assignable",
              labels: [L.promotion],
            },
          ],
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
