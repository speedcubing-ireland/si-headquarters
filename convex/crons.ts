import { internal } from "@/convex/_generated/api"
import { cronJobs } from "convex/server"

const crons = cronJobs()

crons.cron(
  "notification due scan 07:00 UTC",
  "0 7 * * *",
  internal.notifications.due.runDueScan,
  {}
)

crons.cron(
  "notification due scan 08:00 UTC",
  "0 8 * * *",
  internal.notifications.due.runDueScan,
  {}
)

crons.cron(
  "project workflow daily scan 08:15 UTC",
  "15 8 * * *",
  internal.projectWorkflows.mutations.queueDailyRuns,
  {}
)

export default crons
