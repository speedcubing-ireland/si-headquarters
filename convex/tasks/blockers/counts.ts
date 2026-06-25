import { v, type Infer } from "convex/values"

export const blockerBlockedBySummary = v.object({
  name: v.string(),
  isOpen: v.boolean(),
})

export const blockerCounts = v.object({
  count: v.number(),
  openCount: v.number(),
  blockingCount: v.number(),
  blockedBy: v.array(blockerBlockedBySummary),
})

export type BlockerBlockedBySummary = Infer<typeof blockerBlockedBySummary>
export type BlockerCounts = Infer<typeof blockerCounts>

export const EMPTY_BLOCKER_COUNTS: BlockerCounts = {
  count: 0,
  openCount: 0,
  blockingCount: 0,
  blockedBy: [],
}
