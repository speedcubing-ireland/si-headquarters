import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { CRON_EXPRESSIONS } from "./lib/constants";

const crons = cronJobs();

crons.cron(
	"check due dates",
	CRON_EXPRESSIONS.DUE_DATE_CHECK_DAILY_UTC,
	internal.notifications._checkDueDates,
	{},
);

crons.interval(
	"sweep stale dispatches",
	{ minutes: 15 },
	internal.notifications._sweepStaleDispatches,
	{},
);

crons.interval(
	"sweep sponsorship email dispatches",
	{ minutes: 5 },
	internal.sponsorshipEmails._sweepStaleDispatches,
	{},
);

export default crons;
