import { query, mutation } from "@/convex/_generated/server"
import { api } from "@/convex/_generated/api"
import { v } from "convex/values"
import type { ImpersonationLinkResult } from "@/convex/impersonation/validators"
import type {
  SponsorContactForUI,
  SponsorForUI,
} from "@/convex/plugins/sponsor/lib/validators"

export const listSponsors = query({
  args: {},
  handler: async (ctx): Promise<SponsorForUI[]> => {
    return await ctx.runQuery(api.plugins.sponsor.admin.sponsors.list, {})
  },
})

export const listContactsBySponsor = query({
  args: { sponsorId: v.id("sponsors") },
  handler: async (ctx, args): Promise<SponsorContactForUI[]> => {
    return await ctx.runQuery(
      api.plugins.sponsor.admin.contacts.listBySponsor,
      args
    )
  },
})

export const createLink = mutation({
  args: {
    sponsorId: v.id("sponsors"),
    contactId: v.optional(v.id("sponsorContacts")),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<ImpersonationLinkResult> => {
    return await ctx.runMutation(api.plugins.sponsor.impersonation.createLink, {
      sponsorId: args.sponsorId,
      contactId: args.contactId,
      reason: args.reason,
    })
  },
})
