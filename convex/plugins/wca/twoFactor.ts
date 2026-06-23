"use node"

import { generate } from "otplib"
import { ConvexError, v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { isFeatureEnabled } from "@/config/lib/organisation"
import { requireConvexEnv } from "@/convex/envTypes"
import { WCA_2FA_SECRET_ENV } from "@/convex/plugins/wca/definition"
import { action } from "@/convex/_generated/server"

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
    if (!isFeatureEnabled("wca2fa")) {
      throw new ConvexError({
        code: "PRECONDITION_FAILED",
        message: "WCA 2FA is not enabled for this organisation.",
      })
    }

    await ctx.runQuery(internal.permissions.queries.assertWca2faAccess, {})

    let secret: string
    try {
      secret = requireConvexEnv(
        WCA_2FA_SECRET_ENV,
        `${WCA_2FA_SECRET_ENV} is not set in Convex env.`
      ).trim()
      if (secret === "") {
        throw new Error("Empty WCA 2FA secret")
      }
    } catch {
      throw new ConvexError({
        code: "PRECONDITION_FAILED",
        message: `${WCA_2FA_SECRET_ENV} is not set in Convex env.`,
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
