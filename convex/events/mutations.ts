import { internalMutation } from "@/convex/_generated/server"
import {
  eventScheduleSnapshotValidator,
  type EventScheduleSnapshot,
} from "@/convex/events/validators"
import { MAX_EVENT_REPORT_SOURCES } from "@/convex/events/constants"
import { ConvexError, v } from "convex/values"

function assertUniqueEvents(snapshot: EventScheduleSnapshot): void {
  const eventIds = new Set<string>()
  for (const event of snapshot.events) {
    if (eventIds.has(event.eventId)) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Schedule snapshot ${snapshot.sheetId} contains duplicate event ${event.eventId}.`,
      })
    }
    eventIds.add(event.eventId)
  }
}

export const saveScheduleSnapshots = internalMutation({
  args: {
    snapshots: v.array(eventScheduleSnapshotValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.snapshots.length > MAX_EVENT_REPORT_SOURCES) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Too many event schedule snapshots in one update.",
      })
    }

    const snapshotsBySheetId = new Map<string, EventScheduleSnapshot>()
    for (const snapshot of args.snapshots) {
      assertUniqueEvents(snapshot)
      snapshotsBySheetId.set(snapshot.sheetId, snapshot)
    }

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
