import { ConvexError, v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import type { MutationCtx } from "@/convex/_generated/server"
import { internalMutation } from "@/convex/_generated/server"
import { resend } from "@/convex/sendEmails"
import type { ScheduleSponsorshipEmailBatchArgs } from "@/convex/plugins/sponsor/lib/validators"

export type {
  ScheduleSponsorshipEmailBatchArgs,
  SponsorshipEmailRecipient,
} from "@/convex/plugins/sponsor/lib/validators"

export async function scheduleSponsorshipEmailBatch(
  ctx: MutationCtx,
  args: ScheduleSponsorshipEmailBatchArgs
): Promise<void> {
  if (args.recipients.length === 0) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "No recipients specified for sponsorship email batch.",
    })
  }

  await ctx.scheduler.runAfter(
    0,
    internal.plugins.sponsor.emails.sendBatch.sendSponsorshipEmailBatch,
    args
  )
}

/** Used from sponsor auth (mutation context) after React Email render. */
export const deliverSponsorshipEmail = internalMutation({
  args: {
    from: v.string(),
    to: v.string(),
    subject: v.string(),
    html: v.optional(v.string()),
    text: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await resend.sendEmail(ctx, {
      from: args.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    })
  },
})
