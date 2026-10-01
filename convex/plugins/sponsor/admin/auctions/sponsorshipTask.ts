import type { Doc } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { localDateOf, localDateOffset } from "@/convex/notifications/localTime"
import { findCompetitionTaskByTemplateKey } from "@/convex/tasks/templateTasks"
import { SPONSORSHIP_TASK_TEMPLATE_KEY } from "@/convex/templates/registry"
import { resolveAuctionSubject } from "../../lib/auctionSubject"

/**
 * Due date for the competition's Sponsorship task while its auction is open:
 * the day after the auction ends, in the organisation's timezone.
 */
export function sponsorshipTaskDueDate(auctionEndsAt: number): string {
  return localDateOffset(localDateOf(auctionEndsAt), 1)
}

/**
 * Move the competition's Sponsorship task due date to the day after the
 * auction ends. Only HQ competition auctions have a Sponsorship task; an
 * active auction's end cannot be edited, so this runs once on activation.
 */
export async function syncSponsorshipTaskDueDate(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">
): Promise<void> {
  const subject = resolveAuctionSubject(auction)
  if (subject.kind !== "hq_competition") return

  const task = await findCompetitionTaskByTemplateKey(
    ctx,
    subject.competitionId,
    SPONSORSHIP_TASK_TEMPLATE_KEY
  )
  if (task === null) return

  const dueDate = sponsorshipTaskDueDate(auction.endsAt)
  if (task.dueDate === dueDate) return
  await ctx.db.patch("tasks", task._id, { dueDate })
}
