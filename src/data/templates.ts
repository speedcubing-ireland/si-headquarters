import type {
	CompetitionTemplate,
	TaskTemplate,
	TemplateTask,
	Team,
	SeededTeamName,
} from "./types-new";

export function getTeamBySeededName(
	teams: Team[],
	name: SeededTeamName,
): Team | null {
	return teams.find((t) => t.name === name) ?? null;
}

function createStandardCompetitionTemplate(teams: Team[]): CompetitionTemplate {
	const financeTeam = getTeamBySeededName(teams, "Finance Team");
	const competitionsTeam = getTeamBySeededName(teams, "Competitions Team");
	const socialMediaTeam = getTeamBySeededName(teams, "Social Media Team");

	const defaultTasks: TemplateTask[] = [
		{
			title: "Budget Approval",
			description: "Review and approve competition budget",
			status: "to-do",
			priority: "high",
			labels: ["label-budget", "label-5"],
			ownerType: financeTeam ? "team" : null,
			ownerId: financeTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Announcement",
		},
		{
			title: "Venue Booking",
			description: "Confirm and book competition venue",
			status: "to-do",
			priority: "high",
			labels: ["label-venue", "label-5"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Announcement",
		},
		{
			title: "Sponsorship",
			description: "Secure sponsors for the competition",
			status: "to-do",
			priority: "medium",
			labels: ["label-sponsors"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Announcement",
		},
		{
			title: "Social Media Promotion",
			description: "Create and schedule social media posts",
			status: "to-do",
			priority: "medium",
			labels: ["label-marketing"],
			ownerType: socialMediaTeam ? "team" : null,
			ownerId: socialMediaTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Post-Announcement",
		},
		{
			title: "Certificate ready",
			description: "Certificates designed and ordered for the competition",
			status: "to-do",
			priority: "medium",
			labels: ["label-design"],
			ownerType: null,
			ownerId: null,
			suggestedAssigneeId: null,
			phase: "Post-Announcement",
			subTasks: [
				{
					title: "Certificate Designed",
					description:
						"Design competition certificates; requires approval from Graphics.",
					status: "to-do",
					priority: "medium",
					labels: ["label-design"],
					ownerType: competitionsTeam ? "team" : null,
					ownerId: competitionsTeam?.id || null,
					suggestedAssigneeId: null,
					phase: "Post-Announcement",
					requiredApprovalByTeamNames: ["Graphics Team"],
				},
				{
					title: "Certificate Ordered",
					description: "Order certificates for the competition",
					status: "to-do",
					priority: "medium",
					labels: [],
					ownerType: financeTeam ? "team" : null,
					ownerId: financeTeam?.id || null,
					suggestedAssigneeId: null,
					phase: "Post-Announcement",
				},
			],
		},
		{
			title: "Waiting list emailed and refunded",
			description: "Process waiting list and send refund emails",
			status: "to-do",
			priority: "high",
			labels: ["label-registration", "label-logistics"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Competition",
		},
		{
			title: "Pre-comp email sent",
			description: "Send pre-competition information email to competitors",
			status: "to-do",
			priority: "high",
			labels: ["label-logistics", "label-5"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Competition",
		},
		{
			title: "Check in sheet prepared",
			description: "Prepare check-in sheets for competition day",
			status: "to-do",
			priority: "medium",
			labels: ["label-logistics"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Competition",
		},
		{
			title: "Podium photos",
			description: "Take and post podium photos",
			status: "to-do",
			priority: "medium",
			labels: ["label-marketing"],
			ownerType: socialMediaTeam ? "team" : null,
			ownerId: socialMediaTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Post-Competition",
		},
		{
			title: "Budget closed out",
			description: "Close out competition budget and reconcile expenses",
			status: "to-do",
			priority: "high",
			labels: ["label-budget", "label-5"],
			ownerType: financeTeam ? "team" : null,
			ownerId: financeTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Post-Competition",
		},
	];

	return {
		id: "template-standard-competition",
		name: "Standard Competition",
		description:
			"Default template for standard competitions with essential tasks",
		icon: "🏆",
		defaultTasks,
	};
}

function createTaskTemplates(): TaskTemplate[] {
	return [
		{
			id: "template-task-social-media",
			name: "Social Media Post",
			description: "Template for creating social media posts",
			icon: "📱",
			title: "Social Media: {event}",
			descriptionTemplate:
				"Create and schedule social media post for {event}. Include relevant hashtags and competition details.",
			status: "to-do",
			priority: "medium",
			labels: [],
		},
		{
			id: "template-task-certificate",
			name: "Certificate Design",
			description: "Template for designing certificates",
			icon: "📜",
			title: "Design Certificates",
			descriptionTemplate:
				"Design participation and winner certificates for the competition. Ensure they match the event branding.",
			status: "to-do",
			priority: "medium",
			labels: [],
		},
		{
			id: "template-task-venue",
			name: "Venue Booking",
			description: "Template for booking competition venues",
			icon: "🏢",
			title: "Book Venue",
			descriptionTemplate:
				"Contact and confirm venue booking for the competition. Verify capacity, accessibility, and equipment availability.",
			status: "to-do",
			priority: "high",
			labels: [],
		},
	];
}

export function getCompetitionTemplates(teams: Team[]): CompetitionTemplate[] {
	return [createStandardCompetitionTemplate(teams)];
}

export function getTaskTemplates(): TaskTemplate[] {
	return createTaskTemplates();
}
