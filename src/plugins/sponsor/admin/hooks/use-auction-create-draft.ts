import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ManagerSponsor } from "@/plugins/sponsor/admin/manager-types"
import type { AuctionEditorDraft } from "@/plugins/sponsor/admin/auction-editor-draft"
import { toDatetimeLocalInput } from "@/plugins/sponsor/lib/sponsorship-ui"

export interface AuctionDefaults {
  startDelayHours: number
  durationHours: number
}

export function computeEndFromStartMs(
  startMs: number,
  durationHours: number
): number {
  return startMs + durationHours * 60 * 60 * 1000
}

export function computeAuctionScheduleMs(
  now: number,
  defaults: AuctionDefaults
): { startsAt: number; endsAt: number } {
  const startsAt = now + defaults.startDelayHours * 60 * 60 * 1000
  return {
    startsAt,
    endsAt: computeEndFromStartMs(startsAt, defaults.durationHours),
  }
}

function initialCreateDraft(defaults: AuctionDefaults): AuctionEditorDraft {
  const { startsAt, endsAt } = computeAuctionScheduleMs(Date.now(), defaults)
  return {
    framework: "first_sealed",
    startsAtInput: toDatetimeLocalInput(new Date(startsAt)),
    endsAtInput: toDatetimeLocalInput(new Date(endsAt)),
    startPriceEuros: "100",
    invitedSponsorIds: [],
    isCustomOffering: false,
    customOfferingName: "",
    customOfferingDescriptionMarkdown: "",
  }
}

export function useAuctionCreateDraft(
  activeSponsors: ManagerSponsor[],
  defaults: AuctionDefaults | null
) {
  const [draft, setDraft] = useState<AuctionEditorDraft>(() =>
    initialCreateDraft(defaults ?? { startDelayHours: 1, durationHours: 1 })
  )
  const [hasEditedInvites, setHasEditedInvites] = useState(false)
  const [hasEditedSchedule, setHasEditedSchedule] = useState(false)

  const defaultsRef = useRef(defaults)
  defaultsRef.current = defaults

  // Re-seed schedule once settings arrive from Convex, if user hasn't touched them yet.
  useEffect(() => {
    if (defaults === null || hasEditedSchedule) return
    const { startsAt, endsAt } = computeAuctionScheduleMs(Date.now(), defaults)
    setDraft((current) => ({
      ...current,
      startsAtInput: toDatetimeLocalInput(new Date(startsAt)),
      endsAtInput: toDatetimeLocalInput(new Date(endsAt)),
    }))
  }, [defaults, hasEditedSchedule])

  const defaultInvitedSponsorIds = useMemo(
    () => activeSponsors.map((sponsor) => sponsor.id),
    [activeSponsors]
  )

  const effectiveDraft = useMemo<AuctionEditorDraft>(
    () =>
      hasEditedInvites
        ? draft
        : { ...draft, invitedSponsorIds: defaultInvitedSponsorIds },
    [draft, hasEditedInvites, defaultInvitedSponsorIds]
  )

  const onDraftChange = useCallback((patch: Partial<AuctionEditorDraft>) => {
    if (patch.invitedSponsorIds !== undefined) setHasEditedInvites(true)
    if (patch.startsAtInput !== undefined || patch.endsAtInput !== undefined) {
      setHasEditedSchedule(true)
    }
    setDraft((current) => ({ ...current, ...patch }))
  }, [])

  return { draft: effectiveDraft, onDraftChange }
}
