import { internal } from "@/convex/_generated/api"
import { cronJobs } from "convex/server"

const crons = cronJobs()

crons.cron(
  "notification due scan hourly",
  "0 * * * *",
  internal.notifications.due.runDueScan,
  {}
)

crons.cron(
  "project workflow daily scan 08:15 UTC",
  "15 8 * * *",
  internal.projectWorkflows.mutations.queueDailyRuns,
  {}
)

crons.cron(
  "service oauth attempt sweep hourly",
  "20 * * * *",
  internal.integrations.serviceAccountConnect.purgeExpiredAttempts,
  {}
)

crons.cron(
  "sponsor auction schedule + email repair",
  "*/15 * * * *",
  internal.plugins.sponsor.admin.auctions.lifecycle.repairSchedules,
  {}
)

// The WCA has no webhooks, so competition status has to be polled. Two requests
// per run cover every competition, so hourly is cheap; minute 40 keeps it clear
// of the other crons.
crons.cron(
  "wca competition status sync hourly",
  "40 * * * *",
  internal.plugins.wca.statusSyncMutations.queueStatusSync,
  {}
)

// The Social Media Team's Monday 08:00 email of last week's Irish records.
// 08:00 in Dublin is 07:00 UTC in summer and 08:00 UTC in winter, so this ticks
// hourly on Mondays (UTC) and the target gates on local time, claims the week
// once, and retries a failed attempt on a later tick.
crons.cron(
  "social media weekly records email",
  "50 * * * 1",
  internal.plugins.socialMedia.records.digestState.queueWeeklyDigest,
  {}
)

export default crons
