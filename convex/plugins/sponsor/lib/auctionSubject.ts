import { v, type Infer } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"

/**
 * An auction is created for one of three subject kinds:
 * - `hq_competition`: linked to an HQ competition record (today's behaviour).
 * - `wca_competition`: a WCA competition referenced directly by id, with no HQ
 *   competition record.
 * - `custom`: a custom offering (name + markdown) that may optionally reference
 *   an HQ competition for display/history context.
 *
 * The fields are stored flat on the auction document (`subjectKind`,
 * `competitionId`, `wcaCompetitionId`, `customOffering`) so `competitionId`
 * remains the canonical competition-sponsorship subject for HQ competition
 * auctions only. Use {@link resolveAuctionSubject} to read them as a typed
 * discriminated union.
 */
export const auctionSubjectKind = v.union(
  v.literal("hq_competition"),
  v.literal("wca_competition"),
  v.literal("custom")
)
export type AuctionSubjectKind = Infer<typeof auctionSubjectKind>

export const customOfferingValidator = v.object({
  name: v.string(),
  descriptionMarkdown: v.string(),
  associatedCompetitionId: v.optional(v.id("competitions")),
})
export type CustomOffering = Infer<typeof customOfferingValidator>

/** Discriminated union accepted by the `create` mutation. */
export const auctionSubjectInput = v.union(
  v.object({
    kind: v.literal("hq_competition"),
    competitionId: v.id("competitions"),
  }),
  v.object({
    kind: v.literal("wca_competition"),
    wcaCompetitionId: v.string(),
  }),
  v.object({
    kind: v.literal("custom"),
    associatedCompetitionId: v.optional(v.id("competitions")),
    name: v.string(),
    descriptionMarkdown: v.string(),
  })
)
export type AuctionSubjectInput = Infer<typeof auctionSubjectInput>

/** Resolved subject shape returned by API queries. */
export const auctionSubjectView = v.union(
  v.object({
    kind: v.literal("hq_competition"),
    competitionId: v.id("competitions"),
  }),
  v.object({
    kind: v.literal("wca_competition"),
    wcaCompetitionId: v.string(),
  }),
  v.object({
    kind: v.literal("custom"),
    associatedCompetitionId: v.optional(v.id("competitions")),
    name: v.string(),
    descriptionMarkdown: v.string(),
  })
)
export type AuctionSubjectView = Infer<typeof auctionSubjectView>

type AuctionSubjectFields = Pick<
  Doc<"sponsorshipAuctions">,
  "subjectKind" | "competitionId" | "wcaCompetitionId" | "customOffering"
>

/**
 * Read the auction's subject as a typed union. Legacy rows created before the
 * `subjectKind` field existed default to `hq_competition`, so this is safe to
 * call before/without the backfill migration.
 */
export function resolveAuctionSubject(
  auction: AuctionSubjectFields
): AuctionSubjectView {
  const kind = auction.subjectKind ?? "hq_competition"
  if (kind === "wca_competition") {
    return {
      kind: "wca_competition",
      wcaCompetitionId: auction.wcaCompetitionId ?? "",
    }
  }
  if (kind === "custom") {
    return {
      kind: "custom",
      associatedCompetitionId: auction.customOffering?.associatedCompetitionId,
      name: auction.customOffering?.name ?? "",
      descriptionMarkdown: auction.customOffering?.descriptionMarkdown ?? "",
    }
  }
  // hq_competition (and legacy rows). competitionId is always present here by
  // construction; fail loudly for corrupt rows rather than returning an invalid
  // subject view.
  if (auction.competitionId === undefined) {
    throw new Error("HQ competition auction is missing competitionId.")
  }
  return {
    kind: "hq_competition",
    competitionId: auction.competitionId,
  }
}

export function auctionAssociatedCompetitionId(
  auction: Pick<
    Doc<"sponsorshipAuctions">,
    "subjectKind" | "competitionId" | "customOffering"
  >
): Id<"competitions"> | undefined {
  if (auction.subjectKind === "custom") {
    return auction.customOffering?.associatedCompetitionId
  }
  return auction.competitionId
}

/**
 * The display name of what is being auctioned, derived without needing the
 * competition record. The snapshot summary name is populated at creation time
 * for every subject kind, so this works for competition-less auctions too.
 */
export function auctionSubjectName(
  auction: Pick<
    Doc<"sponsorshipAuctions">,
    "subjectKind" | "customOffering" | "competitionSnapshot"
  >
): string {
  const kind = auction.subjectKind ?? "hq_competition"
  if (kind === "custom") {
    return (
      auction.customOffering?.name ??
      auction.competitionSnapshot?.summary.name ??
      "Sponsorship offering"
    )
  }
  return auction.competitionSnapshot?.summary.name ?? "Competition"
}
