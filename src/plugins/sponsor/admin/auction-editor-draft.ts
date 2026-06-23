import type { Id } from "@/convex/_generated/dataModel"
import type { SponsorshipAuctionFramework } from "@/convex/plugins/sponsor/lib/types"
import {
  centsToEuroInput,
  formatCurrencyFromCents,
  hasSameIdSet,
  parseDatetimeLocalInput,
  toDatetimeLocalInput,
} from "@/plugins/sponsor/lib/sponsorship-ui"

export interface AuctionEditorDraft {
  framework: SponsorshipAuctionFramework
  startsAtInput: string
  endsAtInput: string
  startPriceEuros: string
  invitedSponsorIds: Id<"sponsors">[]
  isCustomOffering: boolean
  customOfferingName: string
  customOfferingDescriptionMarkdown: string
}

export interface EditableAuctionSnapshot {
  auction: {
    framework: SponsorshipAuctionFramework
    startsAt: number
    endsAt: number
    startPriceCents: number
    subject:
      | { kind: "hq_competition"; competitionId: Id<"competitions"> }
      | { kind: "wca_competition"; wcaCompetitionId: string }
      | {
          kind: "custom"
          associatedCompetitionId?: Id<"competitions">
          name: string
          descriptionMarkdown: string
        }
  }
  inviteSponsorIds: Id<"sponsors">[]
}

export function createDraftFromManagerView(
  snapshot: EditableAuctionSnapshot
): AuctionEditorDraft {
  return {
    framework: snapshot.auction.framework,
    startsAtInput: toDatetimeLocalInput(new Date(snapshot.auction.startsAt)),
    endsAtInput: toDatetimeLocalInput(new Date(snapshot.auction.endsAt)),
    startPriceEuros: centsToEuroInput(snapshot.auction.startPriceCents),
    invitedSponsorIds: snapshot.inviteSponsorIds,
    isCustomOffering: snapshot.auction.subject.kind === "custom",
    customOfferingName:
      snapshot.auction.subject.kind === "custom"
        ? snapshot.auction.subject.name
        : "",
    customOfferingDescriptionMarkdown:
      snapshot.auction.subject.kind === "custom"
        ? snapshot.auction.subject.descriptionMarkdown
        : "",
  }
}

export function isAuctionDraftDirty(
  draft: AuctionEditorDraft,
  snapshot: EditableAuctionSnapshot
): boolean {
  const startPrice = Number(draft.startPriceEuros)
  const startPriceCents = Number.isFinite(startPrice)
    ? Math.round(startPrice * 100)
    : null
  return (
    draft.framework !== snapshot.auction.framework ||
    parseDatetimeLocalInput(draft.startsAtInput) !==
      snapshot.auction.startsAt ||
    parseDatetimeLocalInput(draft.endsAtInput) !== snapshot.auction.endsAt ||
    startPriceCents !== snapshot.auction.startPriceCents ||
    !hasSameIdSet(draft.invitedSponsorIds, snapshot.inviteSponsorIds) ||
    (snapshot.auction.subject.kind === "custom" &&
      (draft.customOfferingName.trim() !== snapshot.auction.subject.name ||
        draft.customOfferingDescriptionMarkdown !==
          snapshot.auction.subject.descriptionMarkdown))
  )
}

export interface ValidatedAuctionForm {
  startsAt: number
  endsAt: number
  startPriceCents: number
  invitedSponsorIds: Id<"sponsors">[]
}

export type AuctionFormValidation =
  | { ok: true; values: ValidatedAuctionForm }
  | { ok: false; error: string }

export function validateAuctionFormInputs(
  draft: AuctionEditorDraft
): AuctionFormValidation {
  if (draft.invitedSponsorIds.length === 0) {
    return { ok: false, error: "Select at least one invited sponsor." }
  }
  const startsAt = parseDatetimeLocalInput(draft.startsAtInput)
  const endsAt = parseDatetimeLocalInput(draft.endsAtInput)
  if (startsAt === null || endsAt === null || endsAt <= startsAt) {
    return { ok: false, error: "Enter a valid start/end range." }
  }
  const startPrice = Number(draft.startPriceEuros)
  if (!Number.isFinite(startPrice) || startPrice < 1) {
    return {
      ok: false,
      error: `Start price must be at least ${formatCurrencyFromCents(100)}.`,
    }
  }
  if (draft.isCustomOffering && draft.customOfferingName.trim().length === 0) {
    return { ok: false, error: "Give the custom offering a name." }
  }
  return {
    ok: true,
    values: {
      startsAt,
      endsAt,
      startPriceCents: Math.round(startPrice * 100),
      invitedSponsorIds: draft.invitedSponsorIds,
    },
  }
}
