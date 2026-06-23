import { useEffect, useState } from "react"
import { useAction } from "convex/react"
import { Loader2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { MarkdownEditorField } from "@/features/shared/markdown-editor-field"
import { cn } from "@/lib/utils"
import {
  getAuctionSubjectSourceOptions,
  isAllowedAuctionSubjectSource,
  type AuctionSubjectDraft,
  type WcaCompetitionSelection,
} from "@/plugins/sponsor/admin/auction-subject-draft"
import type {
  ManagerCompetition,
  ManagerSponsor,
} from "@/plugins/sponsor/admin/manager-types"
import { CompetitionOverrideAlert } from "@/plugins/sponsor/admin/components/competition-override-alert"
import { competitionPropertyStatusLabel } from "@/plugins/sponsor/lib/sponsorship-ui"

export function AuctionSubjectPicker({
  draft,
  onDraftChange,
  competitions,
  competitionIdByString,
  unsponsoredCompetitionsByPhase,
  sponsoredCompetitions,
  selectedCompetition,
  busyCompetitionId,
  onRevertCompetitionSponsorOverride,
  sponsorById,
}: {
  draft: AuctionSubjectDraft
  onDraftChange: (patch: Partial<AuctionSubjectDraft>) => void
  competitions: ManagerCompetition[]
  competitionIdByString: Map<string, Id<"competitions">>
  unsponsoredCompetitionsByPhase: {
    phase: string
    items: ManagerCompetition[]
  }[]
  sponsoredCompetitions: ManagerCompetition[]
  selectedCompetition: ManagerCompetition | null
  busyCompetitionId: Id<"competitions"> | null
  onRevertCompetitionSponsorOverride: (
    competitionId: Id<"competitions">
  ) => Promise<void>
  sponsorById: Map<Id<"sponsors">, ManagerSponsor>
}) {
  const sourceOptions = getAuctionSubjectSourceOptions()

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Auction source</Label>
        <Tabs
          value={draft.source}
          onValueChange={(value) => {
            if (isAllowedAuctionSubjectSource(value)) {
              onDraftChange({ source: value })
            }
          }}
        >
          <TabsList className="w-full">
            {sourceOptions.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="flex-1"
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {draft.source === "hq_competition" ? (
        <HqCompetitionPicker
          value={draft.hqCompetitionId}
          onChange={(competitionId) => {
            onDraftChange({ hqCompetitionId: competitionId })
          }}
          competitionIdByString={competitionIdByString}
          unsponsoredCompetitionsByPhase={unsponsoredCompetitionsByPhase}
          sponsoredCompetitions={sponsoredCompetitions}
          selectedCompetition={selectedCompetition}
          busyCompetitionId={busyCompetitionId}
          onRevertCompetitionSponsorOverride={
            onRevertCompetitionSponsorOverride
          }
          sponsorById={sponsorById}
        />
      ) : null}

      {draft.source === "wca_competition" ? (
        <WcaCompetitionPicker
          value={draft.wca}
          onChange={(wca) => {
            onDraftChange({ wca })
          }}
        />
      ) : null}

      {draft.source === "custom" ? (
        <CustomOfferingPicker
          name={draft.customName}
          descriptionMarkdown={draft.customDescriptionMarkdown}
          competitionId={draft.customCompetitionId}
          competitions={competitions}
          competitionIdByString={competitionIdByString}
          onNameChange={(customName) => {
            onDraftChange({ customName })
          }}
          onDescriptionChange={(customDescriptionMarkdown) => {
            onDraftChange({ customDescriptionMarkdown })
          }}
          onCompetitionChange={(customCompetitionId) => {
            onDraftChange({ customCompetitionId })
          }}
        />
      ) : null}
    </div>
  )
}

function CompetitionSelect({
  value,
  onChange,
  competitionIdByString,
  unsponsoredCompetitionsByPhase,
  sponsoredCompetitions,
  placeholder,
  includeNoneOption,
}: {
  value: Id<"competitions"> | null
  onChange: (competitionId: Id<"competitions"> | null) => void
  competitionIdByString: Map<string, Id<"competitions">>
  unsponsoredCompetitionsByPhase: {
    phase: string
    items: ManagerCompetition[]
  }[]
  sponsoredCompetitions: ManagerCompetition[]
  placeholder: string
  includeNoneOption?: boolean
}) {
  const NONE_VALUE = "__none__"
  const hasNoneOption = includeNoneOption === true
  return (
    <Select
      value={value ?? (hasNoneOption ? NONE_VALUE : "")}
      onValueChange={(next) => {
        if (next === NONE_VALUE) {
          onChange(null)
          return
        }
        onChange(competitionIdByString.get(next) ?? null)
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {hasNoneOption ? (
          <SelectItem value={NONE_VALUE}>No competition link</SelectItem>
        ) : null}
        {unsponsoredCompetitionsByPhase.map((group) => (
          <SelectGroup key={group.phase}>
            <SelectLabel>Needs Sponsor - {group.phase}</SelectLabel>
            {group.items.map((competition) => (
              <SelectItem key={competition.id} value={competition.id}>
                {competition.name} ({competition.compStart})
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
        {sponsoredCompetitions.length > 0 ? (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Other competitions</SelectLabel>
              {sponsoredCompetitions.map((competition) => (
                <SelectItem key={competition.id} value={competition.id}>
                  {competition.name} ({competition.compStart})
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        ) : null}
      </SelectContent>
    </Select>
  )
}

function HqCompetitionPicker({
  value,
  onChange,
  competitionIdByString,
  unsponsoredCompetitionsByPhase,
  sponsoredCompetitions,
  selectedCompetition,
  busyCompetitionId,
  onRevertCompetitionSponsorOverride,
  sponsorById,
}: {
  value: Id<"competitions"> | null
  onChange: (competitionId: Id<"competitions"> | null) => void
  competitionIdByString: Map<string, Id<"competitions">>
  unsponsoredCompetitionsByPhase: {
    phase: string
    items: ManagerCompetition[]
  }[]
  sponsoredCompetitions: ManagerCompetition[]
  selectedCompetition: ManagerCompetition | null
  busyCompetitionId: Id<"competitions"> | null
  onRevertCompetitionSponsorOverride: (
    competitionId: Id<"competitions">
  ) => Promise<void>
  sponsorById: Map<Id<"sponsors">, ManagerSponsor>
}) {
  return (
    <div className="space-y-2">
      <CompetitionSelect
        value={value}
        onChange={onChange}
        competitionIdByString={competitionIdByString}
        unsponsoredCompetitionsByPhase={unsponsoredCompetitionsByPhase}
        sponsoredCompetitions={sponsoredCompetitions}
        placeholder="Select competition"
      />
      {selectedCompetition !== null ? (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-xs text-muted-foreground">
            Phase: {selectedCompetition.currentPhaseName}
          </p>
          <p className="text-sm font-medium">{selectedCompetition.name}</p>
          <p className="text-xs text-muted-foreground">
            Dates: {selectedCompetition.compStart} -{" "}
            {selectedCompetition.compEnd}
          </p>
          <p className="text-xs text-muted-foreground">
            Sponsor status:{" "}
            {competitionPropertyStatusLabel(
              selectedCompetition.sponsorPropertyStatus
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {selectedCompetition.wcaCompetitionId !== undefined &&
            selectedCompetition.wcaCompetitionId.length > 0
              ? "WCA link present. Full competition details will sync after draft creation."
              : "No WCA link yet. Full competition details cannot sync until linked."}
          </p>
          <CompetitionOverrideAlert
            competition={selectedCompetition}
            manualSponsorName={
              selectedCompetition.manualSponsorId
                ? sponsorById.get(selectedCompetition.manualSponsorId)?.name
                : undefined
            }
            busy={busyCompetitionId === selectedCompetition.id}
            onRevert={(competitionId) =>
              void onRevertCompetitionSponsorOverride(competitionId)
            }
          />
        </div>
      ) : null}
    </div>
  )
}

function WcaCompetitionPicker({
  value,
  onChange,
}: {
  value: WcaCompetitionSelection | null
  onChange: (selection: WcaCompetitionSelection | null) => void
}) {
  const listMyCompetitions = useAction(
    api.plugins.sponsor.integrations.wca.search.listMyWcaCompetitions
  )
  const search = useAction(
    api.plugins.sponsor.integrations.wca.search.searchWcaCompetitions
  )
  const [query, setQuery] = useState("")
  const [myCompetitions, setMyCompetitions] = useState<
    WcaCompetitionSelection[] | undefined
  >(undefined)
  const [searchResults, setSearchResults] = useState<WcaCompetitionSelection[]>(
    []
  )
  const [searchingQuery, setSearchingQuery] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  const activeSearch = query.trim().length < 2 ? null : query.trim()
  const searching = searchingQuery !== null

  useEffect(() => {
    let cancelled = false
    void listMyCompetitions({})
      .then((options) => {
        if (cancelled) return
        setMyCompetitions(options)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError("Could not load your WCA competitions. Try again.")
        setMyCompetitions([])
      })
    return () => {
      cancelled = true
    }
  }, [listMyCompetitions])

  useEffect(() => {
    if (activeSearch === null) {
      setSearchResults([])
      setSearchingQuery(null)
      setSearchError(null)
      return
    }
    let cancelled = false
    const handle = setTimeout(() => {
      setSearchingQuery(activeSearch)
      void search({ query: activeSearch })
        .then((options) => {
          if (cancelled) return
          setSearchResults(options)
          setSearchError(null)
        })
        .catch(() => {
          if (cancelled) return
          setSearchError("Could not search WCA competitions. Try again.")
          setSearchResults([])
        })
        .finally(() => {
          if (cancelled) return
          setSearchingQuery(null)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [activeSearch, search])

  const myItems = myCompetitions ?? []
  const isLoading = myCompetitions === undefined || searching
  const showMySection = myItems.length > 0
  const showSearchSection = activeSearch !== null && searchResults.length > 0
  const showOptionsList = showMySection || showSearchSection

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
          placeholder="Search WCA competitions…"
          className="pl-8"
        />
        {isLoading ? (
          <Loader2 className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {value !== null ? (
        <div className="space-y-1 rounded-md border p-3">
          <p className="text-sm font-medium">{value.name}</p>
          <p className="text-xs text-muted-foreground">
            {[value.city, value.countryIso2].filter(Boolean).join(", ")} ·{" "}
            {value.startDate}
          </p>
          <p className="text-xs text-muted-foreground">WCA id: {value.id}</p>
        </div>
      ) : null}

      {loadError !== null ? (
        <p className="text-xs text-destructive">{loadError}</p>
      ) : null}
      {searchError !== null ? (
        <p className="text-xs text-destructive">{searchError}</p>
      ) : null}

      {myCompetitions !== undefined && activeSearch === null ? (
        <p className="text-xs text-muted-foreground">
          Showing competitions delegated to the HQ WCA account. Type at least 2
          characters to search all competitions.
        </p>
      ) : null}

      {showOptionsList ? (
        <div className="max-h-64 overflow-y-auto rounded-md border">
          {showMySection ? (
            <>
              <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                My competitions
              </p>
              {myItems.map((option) => (
                <WcaCompetitionOptionButton
                  key={option.id}
                  option={option}
                  selected={value?.id === option.id}
                  onSelect={onChange}
                />
              ))}
            </>
          ) : null}
          {showSearchSection ? (
            <>
              <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                Search results
              </p>
              {searchResults.map((option) => (
                <WcaCompetitionOptionButton
                  key={option.id}
                  option={option}
                  selected={value?.id === option.id}
                  onSelect={onChange}
                />
              ))}
            </>
          ) : null}
        </div>
      ) : query.trim().length >= 2 && !isLoading && searchError === null ? (
        <p className="text-xs text-muted-foreground">No competitions found.</p>
      ) : myCompetitions !== undefined &&
        myItems.length === 0 &&
        activeSearch === null &&
        loadError === null ? (
        <p className="text-xs text-muted-foreground">
          No delegated competitions found. Type at least 2 characters to search.
        </p>
      ) : null}
    </div>
  )
}

function WcaCompetitionOptionButton({
  option,
  selected,
  onSelect,
}: {
  option: WcaCompetitionSelection
  selected: boolean
  onSelect: (selection: WcaCompetitionSelection) => void
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onSelect(option)
      }}
      className={cn(
        "flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50",
        selected && "bg-muted"
      )}
    >
      <span className="text-sm font-medium">{option.name}</span>
      <span className="text-xs text-muted-foreground">
        {[option.city, option.countryIso2].filter(Boolean).join(", ")} ·{" "}
        {option.startDate}
      </span>
    </button>
  )
}

function CustomOfferingPicker({
  name,
  descriptionMarkdown,
  competitionId,
  competitions,
  competitionIdByString,
  onNameChange,
  onDescriptionChange,
  onCompetitionChange,
}: {
  name: string
  descriptionMarkdown: string
  competitionId: Id<"competitions"> | null
  competitions: ManagerCompetition[]
  competitionIdByString: Map<string, Id<"competitions">>
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onCompetitionChange: (competitionId: Id<"competitions"> | null) => void
}) {
  const allCompetitionsGroup = [
    { phase: "All competitions", items: competitions },
  ]
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="custom-offering-name" className="text-xs">
          Offering name
        </Label>
        <Input
          id="custom-offering-name"
          value={name}
          onChange={(event) => {
            onNameChange(event.target.value)
          }}
          placeholder="e.g. Title sponsor of the livestream"
        />
      </div>
      <MarkdownEditorField
        id="custom-offering-description"
        label="Offering description"
        placeholder="Describe what the sponsor receives…"
        value={descriptionMarkdown}
        onChange={onDescriptionChange}
      />
      <div className="space-y-2">
        <Label className="text-xs">Link to a competition (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Linking surfaces the winner and amount on that competition's page. The
          auction still shows the custom offering above.
        </p>
        <CompetitionSelect
          value={competitionId}
          onChange={onCompetitionChange}
          competitionIdByString={competitionIdByString}
          unsponsoredCompetitionsByPhase={allCompetitionsGroup}
          sponsoredCompetitions={[]}
          placeholder="No competition link"
          includeNoneOption
        />
      </div>
    </div>
  )
}
