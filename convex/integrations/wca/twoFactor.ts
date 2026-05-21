import { generate } from "otplib"
import { ConvexError, v } from "convex/values"
import { action } from "../../_generated/server"
import { requireVolunteerAction } from "../../lib/oauth"

const WCA_2FA_SECRET_ENV = "WCA_2FA_SECRET"
const PERIOD_SECONDS = 30
const DIGITS = 6

export const generateCode = action({
  args: {},
  returns: v.object({
    code: v.string(),
    digits: v.number(),
    periodSeconds: v.number(),
    generatedAtMs: v.number(),
    expiresAtMs: v.number(),
    serverNowMs: v.number(),
  }),
  handler: async (ctx) => {
    await requireVolunteerAction(ctx)

    const secret = process.env[WCA_2FA_SECRET_ENV]?.trim()
    if (!secret) {
      throw new ConvexError({
        code: "PRECONDITION_FAILED",
        message: `${WCA_2FA_SECRET_ENV} is not configured.`,
      })
    }

    const nowMs = Date.now()
    const epochSeconds = Math.floor(nowMs / 1000)

    let code: string
    try {
      code = await generate({
        secret,
        period: PERIOD_SECONDS,
        digits: DIGITS,
        epoch: epochSeconds,
      })
    } catch {
      throw new ConvexError({
        code: "PRECONDITION_FAILED",
        message: `${WCA_2FA_SECRET_ENV} must contain a valid Base32 secret.`,
      })
    }

    const expiresAtMs =
      (Math.floor(nowMs / (PERIOD_SECONDS * 1000)) + 1) * PERIOD_SECONDS * 1000

    return {
      code,
      digits: DIGITS,
      periodSeconds: PERIOD_SECONDS,
      generatedAtMs: nowMs,
      expiresAtMs,
      serverNowMs: nowMs,
    }
  },
})
