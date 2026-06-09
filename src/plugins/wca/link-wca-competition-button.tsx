import { buildSelectorOptions } from "@/components/data-selectors/selector-options"
import { api } from "@/convex/_generated/api"
import type { FunctionReturnType } from "convex/server"
import {
  LinkResourcePicker,
  useLinkAction,
  useOpenLoad,
} from "@/features/integrations"
import { unknownErrorMessage } from "@/convex/integrations/errorPayload"
import type { LinkResourceActionProps } from "@/plugins/integrations/registry"
import { useAction } from "convex/react"
import { GlobeIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

type WcaCompetition = FunctionReturnType<
  typeof api.plugins.wca.resources.listMyCompetitions
>[number]

const wcaOptionAccessors = {
  getLabel: (competition: WcaCompetition) => competition.name,
  getValue: (competition: WcaCompetition) => competition,
  getValueKey: (competition: WcaCompetition) => competition.id,
  renderItem: (competition: WcaCompetition) => competition.name,
}

const wcaGroupAccessors = {
  getLabel: wcaOptionAccessors.getLabel,
  getValue: wcaOptionAccessors.getValue,
  renderItem: wcaOptionAccessors.renderItem,
}

export function LinkWcaCompetitionButton({ object }: LinkResourceActionProps) {
  const { open, setOpen, close, error, setError, pending, run } =
    useLinkAction()
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<WcaCompetition[]>([])
  const [lastFetchedSearch, setLastFetchedSearch] = useState<string | null>(
    null
  )
  const activeSearch = !open || query.trim().length < 2 ? null : query.trim()
  const searching = activeSearch !== null && lastFetchedSearch !== activeSearch
  const listMyCompetitions = useAction(
    api.plugins.wca.resources.listMyCompetitions
  )
  const searchCompetitions = useAction(
    api.plugins.wca.resources.searchCompetitions
  )
  const linkCompetition = useAction(api.plugins.wca.resources.linkCompetition)

  const loadMyCompetitions = useCallback(
    () => listMyCompetitions({ object }),
    [listMyCompetitions, object]
  )

  const { data: myCompetitions, reset: resetMyCompetitions } = useOpenLoad({
    open,
    load: loadMyCompetitions,
    onError: setError,
  })

  useEffect(() => {
    const searchQuery = activeSearch
    if (searchQuery === null) {
      return
    }
    let cancelled = false
    async function loadSearchResults(search: string) {
      try {
        const items = await searchCompetitions({
          object,
          query: search,
        })
        if (!cancelled) {
          setSearchResults(items)
          setLastFetchedSearch(search)
        }
      } catch (caught) {
        if (!cancelled) {
          setError(unknownErrorMessage(caught, { includeConvexError: true }))
        }
      }
    }
    void loadSearchResults(searchQuery)
    return () => {
      cancelled = true
    }
  }, [activeSearch, object, searchCompetitions, setError])

  const model = useMemo(
    () =>
      buildSelectorOptions({
        getValueKey: wcaOptionAccessors.getValueKey,
        groups: [
          {
            key: "mine",
            label: "My competitions",
            items: myCompetitions,
            ...wcaGroupAccessors,
          },
          {
            key: "search",
            label: "Search results",
            items: activeSearch === null ? [] : searchResults,
            ...wcaGroupAccessors,
          },
        ],
      }),
    [activeSearch, myCompetitions, searchResults]
  )

  const emptyMessage =
    query.trim().length < 2
      ? "Type at least 2 characters to search."
      : undefined

  function resetPickerState() {
    setQuery("")
    resetMyCompetitions()
    setSearchResults([])
    setLastFetchedSearch(null)
    setError(null)
  }

  return (
    <LinkResourcePicker<WcaCompetition, WcaCompetition>
      triggerIcon={GlobeIcon}
      triggerIconClassName="text-blue-600"
      triggerLabel="Link WCA competition"
      objectNoun="competitions"
      model={model}
      open={open}
      pending={pending}
      error={error}
      searchable
      searchQuery={query}
      onSearchChange={(nextQuery) => {
        setQuery(nextQuery)
        if (nextQuery.trim().length < 2) {
          setSearchResults([])
          setLastFetchedSearch(null)
        }
      }}
      loading={myCompetitions === undefined || searching}
      emptyMessage={emptyMessage}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          resetPickerState()
        }
      }}
      onPick={async (competition) => {
        const linked = await run(async () => {
          await linkCompetition({
            object,
            wcaCompetitionId: competition.id,
          })
        })
        if (linked) {
          close()
          resetPickerState()
        }
      }}
    />
  )
}
