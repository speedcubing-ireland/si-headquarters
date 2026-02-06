import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { CRON_INTERVALS } from "./lib/constants";

const crons = cronJobs();

crons.interval(
	"check due dates",
	CRON_INTERVALS.DUE_DATE_CHECK,
	internal.notifications._checkDueDates,
	{},
);

crons.interval(
	"check pending reminders",
	CRON_INTERVALS.REMINDER_CHECK,
	internal.reminders._checkPendingReminders,
	{},
);

crons.interval(
	"process notification dispatches",
	CRON_INTERVALS.NOTIFICATION_DISPATCH_CHECK,
	internal.notifications._processPendingDispatches,
	{},
);

export default crons;
