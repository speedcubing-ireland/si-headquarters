import { describe, expect, test } from "vitest"
import type { Id } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"
import { resolveUserItems } from "./user-items"
import { resolveSelectedOptions } from "./selector-options"

const alice: PublicUser = { _id: "alice" as Id<"users">, name: "Alice" }
const ben: PublicUser = { _id: "ben" as Id<"users">, name: "Ben" }
const disabled: PublicUser = {
  _id: "disabled" as Id<"users">,
  name: "Disabled",
}

describe("user selector records", () => {
  test("keeps all selected IDs represented while names and pages load", () => {
    const users = resolveUserItems({
      available: undefined,
      knownUsers: [alice],
      selectedIds: [alice._id, ben._id],
    })
    const selectedOptions = resolveSelectedOptions({
      options: [],
      selectedItems: users.selectedUsers,
      values: [alice._id, ben._id],
      getValue: (user) => user._id,
      getValueKey: (id) => id,
      getLabel: (user) => user.name ?? "Unknown user",
      renderItem: (user) => user.name,
    })
    expect(selectedOptions.map((option) => option.value)).toEqual([
      alice._id,
      ben._id,
    ])
    expect(users.items).toBeUndefined()
  })

  test("retains disabled users only while selected and never reuses stale available records", () => {
    const options = { available: [alice, ben], knownUsers: [disabled] }
    expect(
      resolveUserItems({ ...options, selectedIds: [disabled._id] }).items
    ).toEqual([alice, ben, disabled])
    expect(resolveUserItems({ ...options, selectedIds: [] }).items).toEqual([
      alice,
      ben,
    ])
  })

  test("deduplicates page extras, puts yourself first, and uses fresh records", () => {
    expect(
      resolveUserItems({
        available: [alice, ben, ben],
        knownUsers: [{ ...alice, name: "Old name" }],
        selectedIds: [alice._id],
        currentUserId: ben._id,
      }).items
    ).toEqual([ben, alice])
  })
})
