import { httpRouter } from "convex/server"
import { httpAction } from "@/convex/_generated/server"
import { auth } from "@/convex/auth"
import { discordInteractions } from "@/convex/notifications/interactions"
import { registerSponsorHttpRoutes } from "@/convex/plugins/sponsor/http"
import { resend } from "@/convex/sendEmails"

const http = httpRouter()

auth.addHttpRoutes(http)
registerSponsorHttpRoutes(http)

http.route({
  path: "/resend-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    return await resend.handleResendEventWebhook(ctx, req)
  }),
})

http.route({
  path: "/discord/interactions",
  method: "POST",
  handler: discordInteractions,
})

export default http
