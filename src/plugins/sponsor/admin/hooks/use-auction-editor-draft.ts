import { useCallback, useMemo, useState } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import type { ManagerView } from "@/plugins/sponsor/admin/manager-types"
import {
  createDraftFromManagerView,
  isAuctionDraftDirty,
  type AuctionEditorDraft,
} from "@/plugins/sponsor/admin/auction-editor-draft"

interface DraftState {
  auctionId: Id<"sponsorshipAuctions">
  draft: AuctionEditorDraft
}

export function useAuctionEditorDraft(managerView: ManagerView | null) {
  const [draftState, setDraftState] = useState<DraftState | null>(null)

  const draft = useMemo(() => {
    if (managerView === null) return null
    if (draftState?.auctionId === managerView.auction.id) {
      return draftState.draft
    }
    return createDraftFromManagerView(managerView)
  }, [draftState, managerView])

  const dirty = useMemo(() => {
    if (managerView === null || draft === null) return false
    return isAuctionDraftDirty(draft, managerView)
  }, [draft, managerView])

  const updateDraft = useCallback(
    (patch: Partial<AuctionEditorDraft>) => {
      if (managerView === null) return
      setDraftState((current) => {
        const currentDraft =
          current?.auctionId === managerView.auction.id
            ? current.draft
            : createDraftFromManagerView(managerView)
        return {
          auctionId: managerView.auction.id,
          draft: { ...currentDraft, ...patch },
        }
      })
    },
    [managerView]
  )

  return { draft, dirty, updateDraft }
}
