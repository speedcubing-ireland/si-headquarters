import { describe, expect, it } from "vitest"
import { createSponsorSiteRewrite } from "./sponsor-site-rewrite"

describe("createSponsorSiteRewrite", () => {
  const rewrite = createSponsorSiteRewrite()

  it("maps public browser URLs to internal sponsor routes on input", () => {
    const url = new URL("http://localhost:5174/login?next=1")
    const result = rewrite.input?.({ url }) as URL
    expect(result.pathname).toBe("/sponsor/login")
    expect(result.search).toBe("?next=1")
  })

  it("maps the guide page on input and output", () => {
    const input = rewrite.input?.({
      url: new URL("http://localhost:5174/guide"),
    }) as URL
    expect(input.pathname).toBe("/sponsor/guide")

    const output = rewrite.output?.({
      url: new URL("http://localhost:5174/sponsor/guide"),
    }) as URL
    expect(output.pathname).toBe("/guide")
  })

  it("maps internal sponsor routes to public browser URLs on output", () => {
    const url = new URL("http://localhost:5174/sponsor/auctions/abc123")
    const result = rewrite.output?.({ url }) as URL
    expect(result.pathname).toBe("/auctions/abc123")
  })

  it("routes unknown main-app paths to the sponsor not-found route on input", () => {
    const url = new URL("http://localhost:5174/competitions")
    const result = rewrite.input?.({ url }) as URL
    expect(result.pathname).toBe("/sponsor/404")
  })
})
