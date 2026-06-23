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
  computeAuctionScheduleMs,
  computeEndFromStartMs,
} from "@/plugins/sponsor/admin/hooks/use-auction-create-draft"
import {
  SPONSORSHIP_AUCTION_FRAMEWORKS,
  auctionFrameworkLabel,
} from "@/convex/plugins/sponsor/lib/types"
import {
  auctionScheduleDraftLabels,
  currencyInputLabel,
  isSponsorshipFramework,
  parseDatetimeLocalInput,
  toDatetimeLocalInput,
} from "@/plugins/sponsor/lib/sponsorship-ui"
import { useAuctionSettings } from "@/plugins/sponsor/hooks/use-sponsorship"

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
  const { settings } = useAuctionSettings()
  const defaults = settings ?? { startDelayHours: 1, durationHours: 1 }

  const toggleSponsorInvite = (sponsorId: Id<"sponsors">) => {
    onDraftChange({
      invitedSponsorIds: draft.invitedSponsorIds.includes(sponsorId)
        ? draft.invitedSponsorIds.filter((id) => id !== sponsorId)
        : [...draft.invitedSponsorIds, sponsorId],
    })
  }

  const startMs = parseDatetimeLocalInput(draft.startsAtInput)
  const { opensIn: opensInLabel, duration: durationLabel } =
    auctionScheduleDraftLabels(draft.startsAtInput, draft.endsAtInput)

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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const startsAt = computeAuctionScheduleMs(
                  Date.now(),
                  defaults
                ).startsAt
                onDraftChange({
                  startsAtInput: toDatetimeLocalInput(new Date(startsAt)),
                })
              }}
            >
              Set start to {defaults.startDelayHours}h from now
            </Button>
            {opensInLabel !== null ? (
              <span className="text-xs text-muted-foreground">
                {opensInLabel}
              </span>
            ) : null}
          </div>
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={startMs === null}
              onClick={() => {
                if (startMs === null) return
                const endMs = computeEndFromStartMs(
                  startMs,
                  defaults.durationHours
                )
                onDraftChange({
                  endsAtInput: toDatetimeLocalInput(new Date(endMs)),
                })
              }}
            >
              Set end to {defaults.durationHours}h after start
            </Button>
            {durationLabel !== null ? (
              <span className="text-xs text-muted-foreground">
                Duration: {durationLabel}
              </span>
            ) : null}
          </div>
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
