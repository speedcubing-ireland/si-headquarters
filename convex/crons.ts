import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
	"check due dates",
	{ hours: 1 },
	internal.notifications._checkDueDates,
	{},
);

crons.interval(
	"check pending reminders",
	{ minutes: 15 },
	internal.reminders._checkPendingReminders,
	{},
);

export default crons;
