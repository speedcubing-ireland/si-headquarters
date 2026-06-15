"use node"

import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { internalAction } from "@/convex/_generated/server"
import {
  buildSponsorshipEmailHtml,
  buildSponsorshipEmailPlainText,
} from "@/convex/plugins/sponsor/emails/render"

export const processSponsorshipEmailDispatches = internalAction({
  args: { dispatchIds: v.array(v.id("sponsorshipEmailDispatches")) },
  returns: v.object({
    sent: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    let sent = 0
    let skipped = 0

    for (const dispatchId of args.dispatchIds) {
      const dispatch = await ctx.runMutation(
        internal.plugins.sponsor.emails.send
          .claimSponsorshipEmailDispatchForRender,
        { dispatchId }
      )
      if (!dispatch) {
        skipped += 1
        continue
      }

      try {
        const buildInput = {
          emailType: dispatch.emailType,
          recipientName: dispatch.recipientName,
          context: dispatch.context,
          messageFallback: dispatch.message,
        }
        const [html, text] = await Promise.all([
          buildSponsorshipEmailHtml(buildInput),
          buildSponsorshipEmailPlainText(buildInput),
        ])

        await ctx.runMutation(
          internal.plugins.sponsor.emails.send.deliverSponsorshipEmailDispatch,
          { dispatchId, html, text }
        )
        sent += 1
      } catch (error) {
        await ctx.runMutation(
          internal.plugins.sponsor.emails.send
            .recordSponsorshipEmailDispatchFailure,
          {
            dispatchId,
            error: error instanceof Error ? error.message : String(error),
          }
        )
        skipped += 1
      }
    }

    return { sent, skipped }
  },
})
