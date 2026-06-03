"use node"

import { ConvexError, v } from "convex/values"
import { internalAction } from "@/convex/_generated/server"
import { resend } from "@/convex/sendEmails"
import { getSponsorshipSenderAddress } from "@/convex/plugins/sponsor/emails/sender"
import {
  buildSponsorshipEmailHtml,
  buildSponsorshipEmailPlainText,
} from "@/convex/plugins/sponsor/emails/render"
import {
  scheduleSponsorshipEmailBatchArgs,
  type ScheduleSponsorshipEmailBatchArgs,
} from "@/convex/plugins/sponsor/lib/validators"
import { normalizeEmail } from "@/convex/plugins/sponsor/sanitize"

export const sendSponsorshipEmailBatch = internalAction({
  args: scheduleSponsorshipEmailBatchArgs,
  returns: v.object({
    sent: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args: ScheduleSponsorshipEmailBatchArgs) => {
    if (args.recipients.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "No recipients specified for sponsorship email batch.",
      })
    }

    const from = getSponsorshipSenderAddress()
    let sent = 0
    let skipped = 0

    for (const recipient of args.recipients) {
      const recipientEmail = normalizeEmail(recipient.email)
      if (recipientEmail.length === 0) {
        skipped += 1
        continue
      }

      const buildInput = {
        emailType: args.emailType,
        recipientName: recipient.name,
        context: args.context,
        messageFallback: args.message,
      }

      const [htmlBody, plainTextBody] = await Promise.all([
        buildSponsorshipEmailHtml(buildInput),
        buildSponsorshipEmailPlainText(buildInput),
      ])

      const cc =
        recipient.cc?.map((address) => normalizeEmail(address)).filter(
          (address) => address.length > 0 && address !== recipientEmail
        ) ?? []
      await resend.sendEmail(ctx, {
        from,
        to: recipientEmail,
        ...(cc.length > 0 ? { cc } : {}),
        subject: args.subject,
        html: htmlBody,
        text: plainTextBody,
      })
      sent += 1
    }

    return { sent, skipped }
  },
})
