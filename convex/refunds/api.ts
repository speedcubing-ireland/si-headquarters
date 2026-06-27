import { ConvexError, type Infer, v } from "convex/values"
import {
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "@/convex/_generated/server"
import type { Id } from "@/convex/_generated/dataModel"
import { normalizeWcaId } from "@/convex/plugins/wca/registrationsLib"
import { requireRefundsAccess } from "@/convex/permissions/principal"

const WCA_ID_REGEX = /^\d{4}[A-Z]{4}\d{2}$/

export const listVolunteerShape = v.object({
  id: v.id("refundVolunteers"),
  name: v.string(),
  wcaId: v.optional(v.string()),
  transferToWcaIds: v.array(v.string()),
  archived: v.boolean(),
})

export const volunteerMatchStatusShape = v.union(
  v.literal("already_refunded"),
  v.literal("refund_due")
)
export const volunteerMatchShape = v.object({
  volunteerId: v.id("refundVolunteers"),
  name: v.string(),
  wcaId: v.optional(v.string()),
  transferToWcaIds: v.array(v.string()),
  matchedWcaIds: v.array(v.string()),
  status: volunteerMatchStatusShape,
  acceptedCount: v.number(),
  paidAcceptedCount: v.number(),
  unpaidAcceptedCount: v.number(),
  paidFirstNames: v.array(v.string()),
  paidComments: v.array(v.string()),
  paidAdminComments: v.array(v.string()),
  unpaidFirstNames: v.array(v.string()),
  unpaidComments: v.array(v.string()),
  unpaidAdminComments: v.array(v.string()),
  dueRegistrationId: v.union(v.number(), v.null()),
  dueRegistrationFirstName: v.union(v.string(), v.null()),
  dueRegistrationEditUrl: v.union(v.string(), v.null()),
})

export const competitionRefundStatusShape = v.union(
  volunteerMatchStatusShape,
  v.literal("no_eligible_volunteer")
)

export const competitionRefundSummaryShape = v.object({
  competitionId: v.string(),
  competitionName: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  wcaUrl: v.string(),
  status: competitionRefundStatusShape,
  registrationCount: v.number(),
  acceptedRegistrationCount: v.number(),
  volunteerMatches: v.array(volunteerMatchShape),
  error: v.union(v.string(), v.null()),
})

export const refundComputationResultShape = v.object({
  periodStartDate: v.string(),
  periodEndDate: v.string(),
  competitions: v.array(competitionRefundSummaryShape),
})

/** Single source of truth: types derived from validators (Convex pattern). */
export type RefundVolunteerRecord = Infer<typeof listVolunteerShape>
export type RefundVolunteerMatch = Infer<typeof volunteerMatchShape>
export type RefundCompetitionStatus = Infer<typeof competitionRefundStatusShape>
export type CompetitionRefundSummary = Infer<
  typeof competitionRefundSummaryShape
>
export type RefundComputationResult = Infer<typeof refundComputationResultShape>

function normalizeVolunteerName(name: string): string {
  return name.trim()
}

function parseVolunteerWcaId(wcaId: string | undefined): string | undefined {
  if (wcaId === undefined || wcaId === "") return undefined
  const normalized = normalizeWcaId(wcaId)
  if (normalized === "") return undefined
  if (!WCA_ID_REGEX.test(normalized)) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "WCA ID must be in format YYYYAAAA##.",
    })
  }
  return normalized
}

function parseVolunteerWcaIdList(values: string[] | undefined): string[] {
  if (values === undefined || values.length === 0) return []
  const normalized = values.map((entry) => {
    const parsed = parseVolunteerWcaId(entry)
    if (parsed === undefined) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Invalid WCA ID: ${entry}`,
      })
    }
    return parsed
  })
  return [...new Set(normalized)]
}

function mapVolunteerDoc(doc: {
  _id: Id<"refundVolunteers">
  name: string
  wcaId?: string
  transferToWcaIds?: string[]
  archived: boolean
}): RefundVolunteerRecord {
  return {
    id: doc._id,
    name: doc.name,
    wcaId: doc.wcaId,
    transferToWcaIds: parseVolunteerWcaIdList(doc.transferToWcaIds),
    archived: doc.archived,
  }
}

async function listOrderedVolunteers(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("refundVolunteers")
    .withIndex("by_archived_name", (q) => q.eq("archived", false))
    .collect()
}

async function ensureUniqueVolunteerWcaId(
  ctx: QueryCtx | MutationCtx,
  wcaId: string,
  excludeId?: Id<"refundVolunteers">
) {
  const existing = await ctx.db
    .query("refundVolunteers")
    .withIndex("by_wca_id", (q) => q.eq("wcaId", wcaId))
    .collect()
  const collision = existing.find(
    (doc) => !doc.archived && doc._id !== excludeId
  )
  if (collision) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "A volunteer with this WCA ID already exists.",
    })
  }
}

export const listVolunteers = query({
  args: {},
  returns: v.array(listVolunteerShape),
  handler: async (ctx) => {
    await requireRefundsAccess(ctx)
    const docs = await listOrderedVolunteers(ctx)
    return docs.map(mapVolunteerDoc)
  },
})

export const listVolunteersInternal = internalQuery({
  args: {},
  returns: v.array(listVolunteerShape),
  handler: async (ctx) => {
    const docs = await listOrderedVolunteers(ctx)
    return docs.map(mapVolunteerDoc)
  },
})

export const createVolunteer = mutation({
  args: {
    name: v.string(),
    wcaId: v.optional(v.string()),
    transferToWcaIds: v.optional(v.array(v.string())),
  },
  returns: v.id("refundVolunteers"),
  handler: async (ctx, args) => {
    await requireRefundsAccess(ctx)
    const name = normalizeVolunteerName(args.name)
    if (name === "") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Volunteer name is required.",
      })
    }
    const wcaId = parseVolunteerWcaId(args.wcaId)
    const transferToWcaIds = parseVolunteerWcaIdList(args.transferToWcaIds)

    if (wcaId === undefined && transferToWcaIds.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          "Either a WCA ID or at least one transfer WCA ID must be provided.",
      })
    }

    if (wcaId !== undefined) {
      await ensureUniqueVolunteerWcaId(ctx, wcaId)
    }

    return await ctx.db.insert("refundVolunteers", {
      name,
      wcaId,
      transferToWcaIds,
      archived: false,
    })
  },
})

export const updateVolunteer = mutation({
  args: {
    id: v.id("refundVolunteers"),
    name: v.optional(v.string()),
    wcaId: v.optional(v.string()),
    transferToWcaIds: v.optional(v.array(v.string())),
    archived: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRefundsAccess(ctx)
    const doc = await ctx.db.get("refundVolunteers", args.id)
    if (doc === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Volunteer not found.",
      })
    }

    const patch: {
      name?: string
      wcaId?: string | undefined
      transferToWcaIds?: string[]
      archived?: boolean
    } = {}
    if (args.name !== undefined) {
      const name = normalizeVolunteerName(args.name)
      if (name === "") {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Volunteer name is required.",
        })
      }
      patch.name = name
    }
    if (args.wcaId !== undefined) {
      const wcaId = parseVolunteerWcaId(args.wcaId)
      if (wcaId !== undefined) {
        await ensureUniqueVolunteerWcaId(ctx, wcaId, args.id)
      }
      patch.wcaId = wcaId
    }
    if (args.transferToWcaIds !== undefined) {
      patch.transferToWcaIds = parseVolunteerWcaIdList(args.transferToWcaIds)
    }
    if (args.archived !== undefined) {
      patch.archived = args.archived
    }

    if (Object.keys(patch).length === 0) return null

    if (args.wcaId !== undefined || args.transferToWcaIds !== undefined) {
      const finalWcaId = patch.wcaId ?? doc.wcaId
      const finalTransferToWcaIds =
        patch.transferToWcaIds ?? doc.transferToWcaIds ?? []
      if (finalWcaId === undefined && finalTransferToWcaIds.length === 0) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message:
            "Either a WCA ID or at least one transfer WCA ID must be provided.",
        })
      }
    }

    await ctx.db.patch("refundVolunteers", args.id, patch)
    return null
  },
})

export const deleteVolunteer = mutation({
  args: { id: v.id("refundVolunteers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRefundsAccess(ctx)
    const doc = await ctx.db.get("refundVolunteers", args.id)
    if (doc === null) return null
    await ctx.db.delete("refundVolunteers", args.id)
    return null
  },
})
