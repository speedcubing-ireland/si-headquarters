export { usePhases } from "./convex/use-phases";
export { useLabels, useLabelMutations } from "./convex/use-labels";
export { useUsers } from "./convex/use-users";
export { useTeams } from "./convex/use-teams";

export {
	useTasks,
	useTask,
	useTasksForCompetition,
	useTaskMutations,
} from "./convex/use-tasks";
export type { TaskMutations } from "./convex/use-tasks";

export {
	useCompetitions,
	useCompetition,
	useCompetitionMutations,
	useCompetitionUpdateMutations,
} from "./convex/use-competitions";

export {
	useCommentsForTask,
	useCommentMutations,
} from "./convex/use-comments";

export {
	useNotifications,
	useNotificationSettings,
	useNotificationSubscriptions,
	useTaskSubscriptionState,
	useUnreadCount,
	useNotificationDiagnostics,
	useNotificationMutations,
} from "./convex/use-notifications";

export {
	usePendingReminders,
	usePendingRemindersForTask,
	useReminderMutations,
	buildOneTimeReminderPayload,
} from "./convex/use-reminders";

export {
	useIsDirector,
	useAdminMembersAndTeams,
	useAdminMemberMutations,
} from "./convex/use-admin";

export {
	useSponsors,
	useIsSponsorshipManager,
	useSponsorMutations,
	useSponsorshipCompetitionsForManager,
	useSponsorshipAuctionsForCompetition,
	useSponsorshipAuctionsForManager,
	useSponsorshipAuctionManagerView,
	useSponsorshipAuctionMutations,
} from "./convex/use-sponsorship";
