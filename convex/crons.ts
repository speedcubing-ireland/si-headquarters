import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"
import { CRON_EXPRESSIONS } from "./lib/constants"

const crons = cronJobs()

crons.cron(
  "check due dates",
  CRON_EXPRESSIONS.DUE_DATE_CHECK_DAILY_UTC,
  internal.notifications.internal._checkDueDates,
  {}
)

export default crons
