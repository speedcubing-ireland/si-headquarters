import { afterEach, describe, expect, test, vi } from "vitest"
import { parseCanvaDesignUrl } from "@/convex/plugins/canva/api"
import {
  fetchCanvaThumbnailUrl,
  parseCanvaFolderInput,
} from "@/convex/plugins/canva/helpers"

afterEach(() => {
  vi.restoreAllMocks()
})

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

  test("rejects lookalike hosts and insecure Canva URLs", () => {
    expect(() =>
      parseCanvaDesignUrl("https://canva.com.attacker.example/design/DAFabc")
    ).toThrow(/Could not parse/)
    expect(() =>
      parseCanvaDesignUrl("http://www.canva.com/design/DAFabc")
    ).toThrow(/Could not parse/)
    expect(() =>
      parseCanvaFolderInput("https://evilcanva.com/folder/FAKE")
    ).toThrow(/Folder URL/)
  })
})

describe("fetchCanvaThumbnailUrl", () => {
  test("loads a thumbnail without requiring the design to have a title", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        design: {
          id: "DAFabc123",
          thumbnail: { url: "https://canva.example/temporary-thumbnail.png" },
        },
      })
    )

    await expect(
      fetchCanvaThumbnailUrl("access-token", "DAFabc123")
    ).resolves.toBe("https://canva.example/temporary-thumbnail.png")
  })
})
