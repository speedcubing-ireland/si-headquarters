import { useCallback, useMemo, useState } from "react"
import type { ManagerSponsor } from "@/plugins/sponsor/admin/manager-types"
import type { AuctionEditorDraft } from "@/plugins/sponsor/admin/auction-editor-draft"
import { toDatetimeLocalInput } from "@/plugins/sponsor/lib/sponsorship-ui"

function initialCreateDraft(): AuctionEditorDraft {
  const now = Date.now()
  return {
    framework: "first_sealed",
    startsAtInput: toDatetimeLocalInput(new Date(now + 60 * 60 * 1000)),
    endsAtInput: toDatetimeLocalInput(new Date(now + 2 * 60 * 60 * 1000)),
    startPriceEuros: "100",
    invitedSponsorIds: [],
  }
}

export function useAuctionCreateDraft(activeSponsors: ManagerSponsor[]) {
  const [draft, setDraft] = useState<AuctionEditorDraft>(initialCreateDraft)
  const [hasEditedInvites, setHasEditedInvites] = useState(false)

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
    setDraft((current) => ({ ...current, ...patch }))
  }, [])

  return { draft: effectiveDraft, onDraftChange }
}
