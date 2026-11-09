import {
  applyDiscordNotificationTestEnv,
  installDiscordApiFetchStub,
} from "./convex/testing/discordNotificationTestEnv"

process.env.SITE_URL ??= "http://localhost:5173"
process.env.SPONSOR_SITE_URL ??= "http://localhost:5174"
process.env.RESEND_TEST_MODE ??= "true"

applyDiscordNotificationTestEnv()
installDiscordApiFetchStub()
