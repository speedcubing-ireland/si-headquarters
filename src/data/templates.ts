import type {
	CompetitionTemplate,
	TemplateTask,
	Team,
	SeededTeamName,
} from "./types-new";
import { TEAM_NAMES } from "../../convex/lib/constants";

export function getTeamBySeededName(
	teams: Team[],
	name: SeededTeamName,
): Team | null {
	return teams.find((t) => t.name === name) ?? null;
}

function createStandardCompetitionTemplate(): CompetitionTemplate {
	const defaultTasks: TemplateTask[] = [
		{
			title: "Size and venue picked",
			description: "Pick a venue and expected competitor limit",
			status: "backlog",
			priority: "high",
			labels: ["Venue"],
			ownerTeamName: TEAM_NAMES.COMPETITIONS,
			phase: "Concept",
		},
		{
			title: "Competition budgeted",
			description: "Budget put onto competition sheet and approved as needed",
			status: "backlog",
			priority: "high",
			labels: ["Budget"],
			ownerTeamName: TEAM_NAMES.COMPETITIONS,
			phase: "Concept",
		},
		{
			title: "Venue booked",
			description: `Confirm the venue booking:
- Ensure deposit is paid when required and logged in budget sheet
- Add booking confirmation to the competition's google drive folder`,
			status: "backlog",
			priority: "high",
			labels: ["Venue", "Budget"],
			ownerTeamName: TEAM_NAMES.COMPETITIONS,
			phase: "Pre-Announcement",
			requiredApprovalByTeamNames: [TEAM_NAMES.FINANCE],
		},
		{
			title: "Schedule made",
			description: `Build, review, and publish the official competition schedule:
- Design the initial schedule
- Review the events and rounds against nearby competitions
- Publish the schedule to WCA and verify cutoffs/time limits are correct`,
			status: "backlog",
			priority: "high",
			labels: ["Schedule"],
			ownerTeamName: TEAM_NAMES.COMPETITIONS,
			requiredApprovalByTeamNames: [TEAM_NAMES.DELEGATES],
			phase: "Pre-Announcement",
			linkedActionShortIds: ["sheet.transfer-schedule-to-wca"],
		},
		{
			title: "Sponsorship",
			description: "Secure sponsors and update sponsorship details.",
			status: "backlog",
			priority: "medium",
			labels: ["Sponsors"],
			ownerTeamName: TEAM_NAMES.COMPETITIONS,
			phase: "Pre-Announcement",
			subTasks: [
				{
					title: "Sponsor bidding",
					description: "Allow sponsors to bid for this competition",
					status: "backlog",
					priority: "high",
					labels: ["Sponsors"],
					ownerTeamName: TEAM_NAMES.FINANCE,
					phase: "Pre-Announcement",
				},
			],
		},
		{
			title: "Social media promotion",
			description: `Publish social announcements across key channels:
- Post competition announcement in Discord and open a discussion thread
- Publish competition announcement and registration posts to social channels`,
			status: "backlog",
			priority: "medium",
			labels: ["Promotion"],
			ownerTeamName: TEAM_NAMES.SOCIAL_MEDIA,
			phase: "Post-Announcement",
			subTasks: [
				{
					title: "Instagram and Facebook posts published",
					description:
						"Publish competition announcement and registration posts to social channels.",
					status: "backlog",
					priority: "medium",
					labels: ["Promotion"],
					ownerTeamName: TEAM_NAMES.SOCIAL_MEDIA,
					phase: "Post-Announcement",
				},
			],
		},
		{
			title: "Competition delegates and organisers pre-registered",
			description:
				"Ensure delegates and organisers are pre-registered on WCA before registration scales.",
			status: "backlog",
			priority: "low",
			labels: ["Registration"],
			ownerTeamName: TEAM_NAMES.DELEGATES,
			phase: "Post-Announcement",
		},
		{
			title: "Certificates ready",
			description: "Design and order certificates for the competition.",
			status: "backlog",
			priority: "medium",
			labels: ["Printing"],
			ownerTeamName: TEAM_NAMES.FINANCE,
			phase: "Post-Announcement",
			subTasks: [
				{
					title: "Certificates designed",
					description:
						"Prepare final certificate designs for approval and print.",
					status: "backlog",
					priority: "medium",
					labels: ["Design", "Certificate"],
					ownerTeamName: TEAM_NAMES.COMPETITIONS,
					requiredApprovalByTeamNames: [TEAM_NAMES.GRAPHICS],
					phase: "Post-Announcement",
					linkedActionShortIds: ["canva.certificates"],
				},
			],
		},
		{
			title: "Lanyard designed",
			description: "Create and approve the lanyard design for event use.",
			status: "backlog",
			priority: "low",
			labels: ["Design"],
			ownerTeamName: TEAM_NAMES.GRAPHICS,
			requiredApprovalByTeamNames: [TEAM_NAMES.GRAPHICS],
			phase: "Post-Announcement",
			linkedActionShortIds: ["canva.lanyards"],
		},
		{
			title: "Groups and printing done",
			description: `Finalize groups and print all required competition materials:
- Adjust the schedule based on final registrations and event load
- Generate final groups using approved grouping tools
- Print scorecards and lanyards from approved design files`,
			status: "backlog",
			priority: "high",
			labels: ["Registration", "Printing"],
			ownerTeamName: TEAM_NAMES.COMPETITIONS,
			phase: "Pre-Competition",
			subTasks: [
				{
					title: "Schedule finalised for actual registration numbers",
					description:
						"Adjust the schedule based on final registrations and event load.",
					status: "backlog",
					priority: "high",
					labels: ["Schedule"],
					ownerTeamName: TEAM_NAMES.COMPETITIONS,
					requiredApprovalByTeamNames: [TEAM_NAMES.DELEGATES],
					phase: "Pre-Competition",
				},
				{
					title: "Groups generated",
					description: "Generate final groups using approved grouping tools.",
					status: "backlog",
					priority: "high",
					labels: ["Registration"],
					ownerTeamName: TEAM_NAMES.DELEGATES,
					phase: "Pre-Competition",
				},
			],
		},
		{
			title: "Waiting list emailed and refunded",
			description:
				"Email the waiting list and process refunds for unaccepted registrations.",
			status: "backlog",
			priority: "high",
			labels: ["Registration", "Budget"],
			ownerTeamName: TEAM_NAMES.COMPETITIONS,
			phase: "Pre-Competition",
		},
		{
			title: "Pre-comp email written and sent",
			description:
				"Write and send pre-competition information email to competitors.",
			status: "backlog",
			priority: "medium",
			labels: ["Registration"],
			ownerTeamName: TEAM_NAMES.COMPETITIONS,
			phase: "Pre-Competition",
		},
		{
			title: "Check-in sheet ready for registration",
			description: "Prepare check-in sheets for registration desk operations.",
			status: "backlog",
			priority: "medium",
			labels: ["Registration"],
			ownerTeamName: TEAM_NAMES.COMPETITIONS,
			phase: "Pre-Competition",
			linkedActionShortIds: ["sheet.populate-checkin"],
		},
		{
			title: "All expenses submitted",
			description: "Collect and submit all competition-related expenses.",
			status: "backlog",
			priority: "high",
			labels: ["Budget"],
			ownerTeamName: TEAM_NAMES.FINANCE,
			phase: "Post-Competition",
		},
		{
			title: "Podium photos posted",
			description: "Publish podium photos after competition completion.",
			status: "backlog",
			priority: "high",
			labels: ["Promotion"],
			ownerTeamName: TEAM_NAMES.SOCIAL_MEDIA,
			phase: "Post-Competition",
		},
		{
			title: "Final budget filled out",
			description:
				"Complete final budget reconciliation and close out finance records.",
			status: "backlog",
			priority: "low",
			labels: ["Budget"],
			ownerTeamName: TEAM_NAMES.FINANCE,
			phase: "Post-Competition",
		},
	];

	return {
		id: "template-normal-competition",
		name: "Normal Competition",
		description: "Default template for competitions",
		icon: "🏆",
		defaultTasks,
	};
}

export function getCompetitionTemplates(): CompetitionTemplate[] {
	return [createStandardCompetitionTemplate()];
}
