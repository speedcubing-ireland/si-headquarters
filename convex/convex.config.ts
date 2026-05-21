import { defineApp } from "convex/server"
import resend from "@convex-dev/resend/convex.config.js"
import sponsorAuth from "./sponsorship/auth/component/sponsorAuth/convex.config"

const app = defineApp()
app.use(resend)
app.use(sponsorAuth)

export default app
