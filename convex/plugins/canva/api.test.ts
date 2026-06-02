import { describe, expect, test } from "vitest"
import { parseCanvaDesignUrl } from "@/convex/plugins/canva/api"

describe("parseCanvaDesignUrl", () => {
  test("extracts design id from standard Canva URLs", () => {
    expect(
      parseCanvaDesignUrl("https://www.canva.com/design/DAFabc123/edit")
    ).toEqual({
      designId: "DAFabc123",
      designUrl: "https://www.canva.com/design/DAFabc123/edit",
    })
  })

  test("throws when design id is missing", () => {
    expect(() => parseCanvaDesignUrl("https://www.canva.com/")).toThrow(
      /Could not parse/
    )
  })
})
