import { beforeEach, describe, expect, test, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { useQuery_experimental } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useChildQuery } from "@/hooks/convex/use-child-query"

vi.mock("convex/react", () => ({ useQuery_experimental: vi.fn() }))
const query = api.competitions.queries.getProperties
const args = { id: "competition" as Id<"competitions"> }

function Content({ parent }: { parent: object | null | undefined }) {
  const result = useChildQuery(query, args, parent)
  return <span>{result === undefined ? "pending" : "loaded"}</span>
}

beforeEach(() => vi.mocked(useQuery_experimental).mockReset())

describe("child queries loading alongside a parent", () => {
  test("start during parent loading and defer child errors", () => {
    vi.mocked(useQuery_experimental).mockReturnValue({
      status: "error",
      error: new Error("Not found"),
    })
    expect(renderToStaticMarkup(<Content parent={undefined} />)).toContain(
      "pending"
    )
    expect(useQuery_experimental).toHaveBeenCalledWith({ query, args })
  })
  test("missing parent skips child queries and preserves the empty page", () => {
    vi.mocked(useQuery_experimental).mockReturnValue({ status: "pending" })
    expect(renderToStaticMarkup(<Content parent={null} />)).toContain("pending")
    expect(useQuery_experimental).toHaveBeenCalledWith({ query, args: "skip" })
  })
  test("existing parent exposes child errors instead of hiding them", () => {
    vi.mocked(useQuery_experimental).mockReturnValue({
      status: "error",
      error: new Error("Read failed"),
    })
    expect(() => renderToStaticMarkup(<Content parent={{}} />)).toThrow(
      "Read failed"
    )
  })
  test("existing parent exposes loaded child data", () => {
    vi.mocked(useQuery_experimental).mockReturnValue({
      status: "success",
      data: { phase: null },
    })
    expect(renderToStaticMarkup(<Content parent={{}} />)).toContain("loaded")
  })
})
