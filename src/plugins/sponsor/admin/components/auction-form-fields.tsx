import { Lock, LockOpen } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Id } from "@/convex/_generated/dataModel"
import type { ManagerSponsor } from "@/plugins/sponsor/admin/manager-types"
import type { AuctionEditorDraft } from "@/plugins/sponsor/admin/auction-editor-draft"
import {
  SPONSORSHIP_AUCTION_FRAMEWORKS,
  auctionFrameworkLabel,
} from "@/convex/plugins/sponsor/lib/types"
import {
  currencyInputLabel,
  isSponsorshipFramework,
} from "@/plugins/sponsor/lib/sponsorship-ui"

export function AuctionFormFields({
  draft,
  onDraftChange,
  activeSponsors,
}: {
  draft: AuctionEditorDraft
  onDraftChange: (patch: Partial<AuctionEditorDraft>) => void
  activeSponsors: ManagerSponsor[]
}) {
  const [isFrameworkUnlocked, setIsFrameworkUnlocked] = useState(false)

  const toggleSponsorInvite = (sponsorId: Id<"sponsors">) => {
    onDraftChange({
      invitedSponsorIds: draft.invitedSponsorIds.includes(sponsorId)
        ? draft.invitedSponsorIds.filter((id) => id !== sponsorId)
        : [...draft.invitedSponsorIds, sponsorId],
    })
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Auction type</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => {
              setIsFrameworkUnlocked((current) => !current)
            }}
          >
            {isFrameworkUnlocked ? (
              <LockOpen className="size-3.5" />
            ) : (
              <Lock className="size-3.5" />
            )}
            <span className="sr-only">
              {isFrameworkUnlocked
                ? "Lock auction type"
                : "Unlock auction type"}
            </span>
          </Button>
        </div>
        <Select
          value={draft.framework}
          onValueChange={(value) => {
            if (!isSponsorshipFramework(value)) return
            onDraftChange({ framework: value })
          }}
          disabled={!isFrameworkUnlocked}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select auction type">
              {auctionFrameworkLabel(draft.framework)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SPONSORSHIP_AUCTION_FRAMEWORKS.map((framework) => (
              <SelectItem key={framework} value={framework}>
                {auctionFrameworkLabel(framework)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 @md/main:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Starts at</p>
          <Input
            type="datetime-local"
            value={draft.startsAtInput}
            onChange={(event) => {
              onDraftChange({ startsAtInput: event.target.value })
            }}
            required
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Ends at</p>
          <Input
            type="datetime-local"
            value={draft.endsAtInput}
            onChange={(event) => {
              onDraftChange({ endsAtInput: event.target.value })
            }}
            required
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {currencyInputLabel("Start price")}
          </p>
          <Input
            type="number"
            min="1"
            step="0.01"
            value={draft.startPriceEuros}
            onChange={(event) => {
              onDraftChange({ startPriceEuros: event.target.value })
            }}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Invited sponsors</p>
        <div className="grid gap-2 @md/main:grid-cols-2">
          {activeSponsors.map((sponsor) => (
            <div
              key={sponsor.id}
              className="flex items-center gap-2 rounded border px-2 py-1.5"
            >
              <Checkbox
                checked={draft.invitedSponsorIds.includes(sponsor.id)}
                onCheckedChange={() => {
                  toggleSponsorInvite(sponsor.id)
                }}
              />
              <span className="text-sm">{sponsor.name}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
