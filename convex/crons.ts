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

// The Social Media Team's Monday 08:00 email of last week's records. Ticks
// hourly so the target's local-time gate alone decides when it goes out, in
// whatever timezone the organisation is configured for; later ticks that day
// only act to retry a failed attempt.
crons.cron(
  "social media weekly records email",
  "50 * * * *",
  internal.plugins.socialMedia.records.digestState.queueWeeklyDigest,
  {}
)

export default crons
