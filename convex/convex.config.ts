import { defineApp } from "convex/server"
import reactions from "@convex/reactions/convex.config.js"
import resend from "@convex-dev/resend/convex.config.js"
import sponsorAuth from "@/convex/plugins/sponsor/auth/component/sponsorAuth/convex.config"
import { convexEnv } from "@/convex/env"

const app = defineApp({
  env: convexEnv,
})
app.use(reactions)
app.use(resend)
app.use(sponsorAuth)

export default app
