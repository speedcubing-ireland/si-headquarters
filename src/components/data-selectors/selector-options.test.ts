import { describe, expect, test } from "vitest"
import {
  buildSelectorOptions,
  getSingleSelectorValue,
  resolveSelectedOptions,
  selectorGroup,
} from "./selector-options"

interface TestItem {
  id: string
  label: string
}

const alpha = { id: "alpha", label: "Alpha" }
const beta = { id: "beta", label: "Beta" }
const gamma = { id: "gamma", label: "Gamma" }
const accessors = {
  getLabel: (item: TestItem) => item.label,
  getValue: (item: TestItem) => item.id,
  getValueKey: (id: string) => id,
  renderItem: (item: TestItem) => item.label,
}

describe("selector options", () => {
  test("normalizes flat options", () => {
    const result = buildSelectorOptions({
      ...accessors,
      items: [alpha, beta],
    })

    expect(result.hasLoadedItems).toBe(true)
    expect(result.itemGroups).toBeUndefined()
    expect(result.items).toMatchObject([
      { key: "alpha", label: "Alpha", value: "alpha" },
      { key: "beta", label: "Beta", value: "beta" },
    ])
    expect(result.rootItems).toBe(result.items)
  })

  test("normalizes grouped options and tracks loaded state", () => {
    const result = buildSelectorOptions({
      getValueKey: (id: string) => id,
      groups: [
        selectorGroup({
          key: "loaded",
          label: "Loaded",
          items: [alpha],
          ...accessors,
        }),
        selectorGroup({
          key: "pending",
          label: "Pending",
          items: undefined,
          ...accessors,
        }),
      ],
    })

    expect(result.hasLoadedItems).toBe(false)
    expect(result.itemGroups).toMatchObject([
      {
        key: "loaded",
        label: "Loaded",
        items: [{ key: "alpha", label: "Alpha", value: "alpha" }],
      },
      { key: "pending", label: "Pending", items: [] },
    ])
    expect(result.items).toHaveLength(1)
    expect(result.rootItems).toBe(result.itemGroups)
  })

  test("resolves a selected fallback while options are not loaded", () => {
    const selected = resolveSelectedOptions({
      ...accessors,
      options: [],
      selectedItem: beta,
      value: "beta",
    })

    expect(selected).toMatchObject([
      { key: "beta", label: "Beta", value: "beta" },
    ])
  })

  test("preserves requested order for multiple selected values", () => {
    const options = buildSelectorOptions({
      ...accessors,
      items: [alpha, beta, gamma],
    })
    const selected = resolveSelectedOptions({
      ...accessors,
      options: options.items,
      values: ["gamma", "alpha"],
    })

    expect(selected.map((option) => option.value)).toEqual(["gamma", "alpha"])
  })

  test("ignores selected values that cannot be resolved", () => {
    const options = buildSelectorOptions({
      ...accessors,
      items: [alpha],
    })
    const selected = resolveSelectedOptions({
      ...accessors,
      options: options.items,
      values: ["missing"],
    })

    expect(selected).toEqual([])
  })

  test("maps a clear selection to null", () => {
    expect(getSingleSelectorValue(null)).toBeNull()
  })
})
