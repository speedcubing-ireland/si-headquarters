import { beforeEach, expect, test, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { useState } from "react"
import { getFunctionName } from "convex/server"
import { usePaginatedQuery, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"
import { useUserItems } from "./user-selector-model"

vi.mock("convex/react", () => ({
  usePaginatedQuery: vi.fn(),
  useQuery: vi.fn(),
}))
vi.mock("@/features/auth", () => ({
  useCan: () => ({ allowed: true, isLoading: false }),
}))

function Picker({
  ids,
  selectedUsers,
}: {
  ids: Id<"users">[]
  selectedUsers?: PublicUser[]
}) {
  const users = useUserItems({ open: true, selectedIds: ids, selectedUsers })
  return (
    <span data-names={users.selectedUsers.map((user) => user.name).join(",")}>
      {users.selectedUsers.map((user) => user._id).join(",")}
    </span>
  )
}

beforeEach(() => {
  vi.mocked(useQuery).mockReset().mockReturnValue(undefined)
  vi.mocked(usePaginatedQuery).mockReset().mockReturnValue({
    results: [],
    status: "LoadingFirstPage",
    isLoading: true,
    loadMore: vi.fn(),
  })
})

test("reuses supplied selected records and fetches only missing labels", () => {
  const alice: PublicUser = { _id: "alice" as Id<"users">, name: "Alice" }
  const ben = "ben" as Id<"users">
  renderToStaticMarkup(<Picker ids={[alice._id]} selectedUsers={[alice]} />)
  expect(useQuery).toHaveBeenCalledWith(api.users.queries.getSelected, "skip")
  renderToStaticMarkup(
    <Picker ids={[alice._id, ben]} selectedUsers={[alice]} />
  )
  expect(useQuery).toHaveBeenCalledWith(api.users.queries.getSelected, {
    scope: undefined,
    userIds: [ben],
  })
})

test("selection changes do not change directory arguments and pending labels preserve IDs", () => {
  const alice = "alice" as Id<"users">
  const ben = "ben" as Id<"users">
  renderToStaticMarkup(<Picker ids={[alice]} />)
  expect(renderToStaticMarkup(<Picker ids={[alice, ben]} />)).toContain(
    "alice,ben"
  )
  const calls = vi.mocked(usePaginatedQuery).mock.calls
  expect(calls.length).toBeGreaterThan(1)
  for (const call of calls) expect(call).toEqual(calls[0])
  expect(useQuery).toHaveBeenCalledWith(api.users.queries.getSelected, {
    scope: undefined,
    userIds: [alice, ben],
  })
})

interface Frame {
  props: Parameters<typeof useUserItems>[0]
  lookup?: PublicUser[]
}

function renderTransition(before: Frame, after: Frame) {
  function Transition() {
    const [changed, setChanged] = useState(false)
    const frame = changed ? after : before
    vi.mocked(useQuery).mockImplementation((...[query]) =>
      getFunctionName(query) === "users/queries:getSelected"
        ? frame.lookup
        : undefined
    )
    const users = useUserItems(frame.props)
    if (!changed) setChanged(true)
    return (
      <span>
        {users.selectedUsers
          .map((user) => user.name ?? "Unknown user")
          .join(",")}
      </span>
    )
  }
  return renderToStaticMarkup(<Transition />)
}

test("retains a selected label outside loaded pages when another selection starts a lookup", () => {
  const disabled: PublicUser = {
    _id: "disabled" as Id<"users">,
    name: "Disabled Alice",
  }
  const ben: PublicUser = { _id: "ben" as Id<"users">, name: "Ben" }
  vi.mocked(usePaginatedQuery).mockReturnValue({
    results: [ben],
    status: "Exhausted",
    isLoading: false,
    loadMore: vi.fn(),
  })
  expect(
    renderTransition(
      {
        props: { open: true, selectedIds: [disabled._id] },
        lookup: [disabled],
      },
      { props: { open: true, selectedIds: [disabled._id, ben._id] } }
    )
  ).toContain("Disabled Alice,Ben")
})

test("fresh supplied labels replace cached labels without a render loop", () => {
  const alice: PublicUser = { _id: "alice" as Id<"users">, name: "Old Alice" }
  expect(
    renderTransition(
      { props: { open: true, selectedIds: [alice._id] }, lookup: [alice] },
      {
        props: {
          open: false,
          selectedIds: [alice._id],
          selectedUsers: [{ ...alice, name: "Current Alice" }],
        },
      }
    )
  ).toContain("Current Alice")
})

test("does not carry cached labels into a different scope or an authoritative empty response", () => {
  const alice: PublicUser = { _id: "alice" as Id<"users">, name: "Alice" }
  const before = {
    props: { open: true, selectedIds: [alice._id] },
    lookup: [alice],
  }
  expect(
    renderTransition(before, { props: before.props, lookup: [] })
  ).toContain("Unknown user")
  expect(
    renderTransition(before, {
      props: {
        ...before.props,
        scope: { type: "projects", id: "project" as Id<"projects"> },
      },
    })
  ).toContain("Unknown user")
})
