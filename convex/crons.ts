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
  "sponsor auction schedule + email repair",
  "*/15 * * * *",
  internal.plugins.sponsor.admin.auctions.lifecycle.repairSchedules,
  {}
)

export default crons
