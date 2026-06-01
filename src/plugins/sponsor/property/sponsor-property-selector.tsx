import { GavelIcon } from "lucide-react"
import { useState } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import * as DataSelector from "@/components/data-selectors/data-selector"
import { useSingleDataSelector } from "@/components/data-selectors/data-selector-model"
import * as SelectorFace from "@/components/data-selectors/selector-face"
import type { CompetitionSponsorOverride } from "@/plugins/sponsor/hooks/competition-sponsor-property"
import type { CompetitionSponsorPropertyStatus } from "@/plugins/sponsor/lib/sponsorship-ui"

export interface SponsorListItem {
  id: Id<"sponsors">
  name: string
  active: boolean
}

const MANUAL_NO_SPONSOR = "__manual_no_sponsor__" as const

interface ManualNoSponsorOption {
  id: typeof MANUAL_NO_SPONSOR
  name: "No Sponsor"
  active: true
}

type SponsorSelectorOption = SponsorListItem | ManualNoSponsorOption

type SponsorSelectorValue = Id<"sponsors"> | typeof MANUAL_NO_SPONSOR

const manualNoSponsorOption: ManualNoSponsorOption = {
  id: MANUAL_NO_SPONSOR,
  name: "No Sponsor",
  active: true,
}

export function SponsorPropertyValueFace({
  displayLabel,
  showAuctionIcon,
}: {
  displayLabel: string
  showAuctionIcon: boolean
}) {
  return (
    <SelectorFace.Root>
      {showAuctionIcon ? (
        <GavelIcon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      ) : null}
      <SelectorFace.Text>{displayLabel}</SelectorFace.Text>
    </SelectorFace.Root>
  )
}

function selectorValueForProperty(input: {
  isManualOverride: boolean
  status: CompetitionSponsorPropertyStatus
  winnerSponsorId: Id<"sponsors"> | undefined
}): SponsorSelectorValue | null {
  if (input.isManualOverride && input.status === "none") {
    return MANUAL_NO_SPONSOR
  }
  return input.winnerSponsorId ?? null
}

export function SponsorPropertySelector({
  disabled,
  displayLabel,
  isManualOverride,
  onChange,
  sponsors,
  status,
  winnerSponsorId,
}: {
  disabled?: boolean
  displayLabel: string
  isManualOverride: boolean
  onChange: (override: CompetitionSponsorOverride | null) => void | Promise<void>
  sponsors: SponsorListItem[]
  status: CompetitionSponsorPropertyStatus
  winnerSponsorId: Id<"sponsors"> | undefined
}) {
  const [open, setOpen] = useState(false)

  const selectorValue = selectorValueForProperty({
    isManualOverride,
    status,
    winnerSponsorId,
  })

  const items: SponsorSelectorOption[] = [
    manualNoSponsorOption,
    ...sponsors.filter((sponsor) => sponsor.active),
  ]

  const selectedItem =
    selectorValue === MANUAL_NO_SPONSOR
      ? manualNoSponsorOption
      : selectorValue !== null
        ? (sponsors.find((sponsor) => sponsor.id === selectorValue) ?? null)
        : null

  const model = useSingleDataSelector<SponsorSelectorOption, SponsorSelectorValue>({
    getLabel: (item) => item.name,
    getValue: (item) =>
      item.id === MANUAL_NO_SPONSOR ? MANUAL_NO_SPONSOR : item.id,
    getValueKey: (value) => value,
    items,
    renderItem: (item) => <span className="truncate">{item.name}</span>,
    selectedItem,
    value: selectorValue,
  })

  const handleChange = (value: SponsorSelectorValue | null) => {
    if (value === null) {
      void onChange(null)
      return
    }
    if (value === MANUAL_NO_SPONSOR) {
      void onChange({ status: "none", manualSponsorId: null })
      return
    }
    void onChange({ status: "sponsor", manualSponsorId: value })
  }

  return (
    <DataSelector.SingleRoot
      model={model}
      open={open}
      searchable
      onOpenChange={setOpen}
      onValueChange={handleChange}
    >
      <DataSelector.ButtonTrigger disabled={disabled} variant="outline">
        <SponsorPropertyValueFace
          displayLabel={displayLabel}
          showAuctionIcon={!isManualOverride}
        />
      </DataSelector.ButtonTrigger>
      <DataSelector.Content
        align="start"
        clearLabel="Use auction result"
        model={model}
        objectNoun="sponsors"
        searchable
      />
    </DataSelector.SingleRoot>
  )
}
