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

export default crons
