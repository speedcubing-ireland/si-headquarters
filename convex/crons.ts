import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { CRON_EXPRESSIONS } from "./lib/constants";

const crons = cronJobs();

crons.cron(
	"check due dates",
	CRON_EXPRESSIONS.DUE_DATE_CHECK_DAILY_UTC,
	internal.notifications.internal._checkDueDates,
	{},
);

crons.cron(
	"sweep email queue",
	CRON_EXPRESSIONS.EMAIL_QUEUE_SWEEP_EVERY_MINUTE,
	internal.emailQueue.api._runSweep,
	{},
);

export default crons;
