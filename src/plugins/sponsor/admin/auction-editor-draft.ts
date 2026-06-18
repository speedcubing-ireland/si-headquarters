import type { Id } from "@/convex/_generated/dataModel"
import type { SponsorshipAuctionFramework } from "@/convex/plugins/sponsor/lib/types"
import {
  centsToEuroInput,
  parseDatetimeLocalInput,
  toDatetimeLocalInput,
} from "@/plugins/sponsor/lib/sponsorship-ui"
import { hasPendingAuctionEdits } from "@/plugins/sponsor/admin/sponsorship-admin-derivations"

export interface AuctionEditorDraft {
  framework: SponsorshipAuctionFramework
  startsAtInput: string
  endsAtInput: string
  startPriceEuros: string
  invitedSponsorIds: Id<"sponsors">[]
}

export interface EditableAuctionSnapshot {
  auction: {
    framework: SponsorshipAuctionFramework
    startsAt: number
    endsAt: number
    startPriceCents: number
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
  }
}

export function isAuctionDraftDirty(
  draft: AuctionEditorDraft,
  snapshot: EditableAuctionSnapshot
): boolean {
  return hasPendingAuctionEdits({
    editFramework: draft.framework,
    editStartsAtInput: draft.startsAtInput,
    editEndsAtInput: draft.endsAtInput,
    editStartPriceEuros: draft.startPriceEuros,
    editInvitedSponsorIds: draft.invitedSponsorIds,
    auction: snapshot.auction,
    inviteSponsorIds: snapshot.inviteSponsorIds,
  })
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
    return { ok: false, error: "Start price must be at least EUR 1.00." }
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
