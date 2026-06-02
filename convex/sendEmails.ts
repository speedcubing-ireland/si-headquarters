import { Resend } from "@convex-dev/resend"
import { components } from "@/convex/_generated/api"
import { env } from "@/convex/_generated/server"

export const resend = new Resend(components.resend, {
  testMode: env.RESEND_TEST_MODE !== "false",
})
