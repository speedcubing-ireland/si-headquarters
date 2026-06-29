import { internalMutation } from "@/convex/_generated/server"
import {
  eventScheduleSnapshotValidator,
  wcaEventSnapshotValidator,
  type EventRound,
} from "@/convex/events/validators"
import { MAX_EVENT_REPORT_SOURCES } from "@/convex/events/constants"
import { ConvexError, v } from "convex/values"

function assertUniqueEvents(label: string, events: EventRound[]): void {
  const eventIds = new Set<string>()
  for (const event of events) {
    if (eventIds.has(event.eventId)) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Schedule snapshot ${label} contains duplicate event ${event.eventId}.`,
      })
    }
    eventIds.add(event.eventId)
  }
}

function assertSnapshotCount(count: number): void {
  if (count > MAX_EVENT_REPORT_SOURCES) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Too many event schedule snapshots in one update.",
    })
  }
}

export const saveScheduleSnapshots = internalMutation({
  args: {
    snapshots: v.array(eventScheduleSnapshotValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertSnapshotCount(args.snapshots.length)

    const snapshotsBySheetId = new Map(
      args.snapshots.map((snapshot) => {
        assertUniqueEvents(snapshot.sheetId, snapshot.events)
        return [snapshot.sheetId, snapshot]
      })
    )

    for (const snapshot of snapshotsBySheetId.values()) {
      const existing = await ctx.db
        .query("eventScheduleSnapshots")
        .withIndex("by_sheetId", (q) => q.eq("sheetId", snapshot.sheetId))
        .unique()
      if (existing === null) {
        await ctx.db.insert("eventScheduleSnapshots", snapshot)
      } else {
        await ctx.db.replace("eventScheduleSnapshots", existing._id, snapshot)
      }
    }
    return null
  },
})

export const saveWcaSnapshots = internalMutation({
  args: {
    snapshots: v.array(wcaEventSnapshotValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertSnapshotCount(args.snapshots.length)

    const snapshotsByCompetition = new Map(
      args.snapshots.map((snapshot) => {
        assertUniqueEvents(snapshot.wcaCompetitionId, snapshot.events)
        return [snapshot.wcaCompetitionId, snapshot]
      })
    )

    for (const snapshot of snapshotsByCompetition.values()) {
      const existing = await ctx.db
        .query("wcaEventSnapshots")
        .withIndex("by_wcaCompetitionId", (q) =>
          q.eq("wcaCompetitionId", snapshot.wcaCompetitionId)
        )
        .unique()
      if (existing === null) {
        await ctx.db.insert("wcaEventSnapshots", snapshot)
      } else {
        await ctx.db.replace("wcaEventSnapshots", existing._id, snapshot)
      }
    }
    return null
  },
})
