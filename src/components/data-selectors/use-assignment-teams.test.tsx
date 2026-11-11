import { beforeEach, expect, test, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { useQuery } from "convex-helpers/react/cache"
import { useCan } from "@/features/auth"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { CommentTargetRef } from "@/convex/utils"
import { useAssignmentTeams } from "./use-assignment-teams"

vi.mock("convex-helpers/react/cache", () => ({ useQuery: vi.fn() }))
vi.mock("@/features/auth", () => ({ useCan: vi.fn() }))

function Picker({
  open = true,
  scope,
}: {
  open?: boolean
  scope?: CommentTargetRef
}) {
  useAssignmentTeams(open, scope)
  return null
}

beforeEach(() => {
  vi.mocked(useQuery).mockReset()
  vi.mocked(useCan).mockReturnValue({ allowed: true, isLoading: false })
})

test("team readers share one cache key across task and project pickers", () => {
  renderToStaticMarkup(
    <Picker scope={{ type: "tasks", id: "task" as Id<"tasks"> }} />
  )
  renderToStaticMarkup(
    <Picker scope={{ type: "projects", id: "project" as Id<"projects"> }} />
  )
  const subscriptions = vi
    .mocked(useQuery)
    .mock.calls.filter(([, args]) => args !== "skip")
  expect(subscriptions).toEqual([
    [api.teams.queries.listForTaskFilters, {}],
    [api.teams.queries.listForTaskFilters, {}],
  ])
})

test("scoped editors without team read permission use the authorised scope", () => {
  vi.mocked(useCan).mockReturnValue({ allowed: false, isLoading: false })
  const scope = { type: "tasks", id: "task" as Id<"tasks"> } as const
  renderToStaticMarkup(<Picker scope={scope} />)
  expect(useQuery).toHaveBeenCalledWith(
    api.teams.queries.listForTaskFilters,
    "skip"
  )
  expect(useQuery).toHaveBeenCalledWith(api.tasks.queries.listAssignmentTeams, {
    scope,
  })
})

test("closed, pending and unauthorised global pickers do not fetch teams", () => {
  renderToStaticMarkup(<Picker open={false} />)
  vi.mocked(useCan).mockReturnValue({ allowed: true, isLoading: true })
  renderToStaticMarkup(<Picker />)
  vi.mocked(useCan).mockReturnValue({ allowed: false, isLoading: false })
  renderToStaticMarkup(<Picker />)
  for (const [, args] of vi.mocked(useQuery).mock.calls)
    expect(args).toBe("skip")
})
