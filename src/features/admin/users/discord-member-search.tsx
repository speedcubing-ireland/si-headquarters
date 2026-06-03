import { useAction } from "convex/react"
import { useEffect, useRef, useState } from "react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { DiscordLink } from "@/convex/users/validators"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { resolveDiscordAvatarUrl } from "@/convex/users/avatar"

interface SearchState {
  query: string
  results: DiscordLink[]
  status: "idle" | "loading" | "error"
  errorMessage: string | null
}

const emptySearchState: SearchState = {
  query: "",
  results: [],
  status: "idle",
  errorMessage: null,
}

export function DiscordMemberSearch({
  onSelect,
  linkedDiscordByUserId,
  currentUserId,
}: {
  onSelect: (member: DiscordLink) => void
  linkedDiscordByUserId: Map<string, { userId: Id<"users">; label: string }>
  currentUserId: Id<"users">
}) {
  const searchMembers = useAction(api.users.actions.searchDiscordGuildMembers)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [searchState, setSearchState] = useState<SearchState>(emptySearchState)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 300)
    return () => {
      window.clearTimeout(timeout)
    }
  }, [query])

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      return
    }

    const query = debouncedQuery
    const requestId = ++requestIdRef.current

    void (async () => {
      try {
        const members = await searchMembers({ query })
        if (requestIdRef.current !== requestId) {
          return
        }
        setSearchState({
          query,
          results: members,
          status: "idle",
          errorMessage: null,
        })
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return
        }
        const message =
          error instanceof Error ? error.message : "Discord search failed."
        setSearchState({
          query,
          results: [],
          status: "error",
          errorMessage: message,
        })
      }
    })()
  }, [debouncedQuery, searchMembers])

  const isLoading =
    debouncedQuery.length >= 2 && searchState.query !== debouncedQuery

  const activeSearch =
    debouncedQuery.length >= 2 && searchState.query === debouncedQuery
      ? searchState
      : {
          ...emptySearchState,
          query: debouncedQuery,
          status: isLoading ? "loading" : "idle",
        }

  return (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder="Search members…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {debouncedQuery.length < 2 ? (
          <CommandEmpty>Type at least 2 characters.</CommandEmpty>
        ) : null}
        {debouncedQuery.length >= 2 && activeSearch.status === "loading" ? (
          <CommandEmpty>Searching…</CommandEmpty>
        ) : null}
        {debouncedQuery.length >= 2 && activeSearch.status === "error" ? (
          <CommandEmpty>
            {activeSearch.errorMessage ?? "Search failed."}
          </CommandEmpty>
        ) : null}
        {debouncedQuery.length >= 2 &&
        activeSearch.status === "idle" &&
        activeSearch.results.length === 0 ? (
          <CommandEmpty>No results.</CommandEmpty>
        ) : null}
        {activeSearch.results.length > 0 ? (
          <CommandGroup>
            {activeSearch.results.map((member) => {
              const existingLink = linkedDiscordByUserId.get(
                member.discordUserId
              )
              const linkedToOther =
                existingLink !== undefined &&
                existingLink.userId !== currentUserId
              const avatarUrl = resolveDiscordAvatarUrl(
                member.discordUserId,
                member.discordAvatarHash
              )

              return (
                <CommandItem
                  key={member.discordUserId}
                  value={member.discordUserId}
                  disabled={linkedToOther}
                  onSelect={() => {
                    if (!linkedToOther) {
                      onSelect(member)
                    }
                  }}
                >
                  <Avatar size="sm">
                    <AvatarImage
                      src={avatarUrl}
                      alt={member.discordDisplayName}
                    />
                    <AvatarFallback>
                      {member.discordDisplayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{member.discordDisplayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{member.discordUsername}
                      {linkedToOther
                        ? ` · linked to ${existingLink.label}`
                        : null}
                    </p>
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  )
}
