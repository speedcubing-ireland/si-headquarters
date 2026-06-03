import { describe, expect, it } from "vitest"
import {
  internalPathToPublic,
  mapBrowserPathToInternal,
  publicPathToInternal,
} from "./sponsor-site"

describe("sponsor-site path mapping", () => {
  it.each([
    ["/", "/sponsor/"],
    ["/login", "/sponsor/login"],
    ["/guide", "/sponsor/guide"],
    ["/settings", "/sponsor/settings"],
    ["/auctions", "/sponsor/auctions"],
    ["/auctions/abc123", "/sponsor/auctions/abc123"],
    ["/sponsor/login", "/sponsor/login"],
    ["/competitions", "/sponsor/404"],
    ["/plugins/sponsorship", "/sponsor/404"],
  ])("public %s → internal %s", (publicPath, internalPath) => {
    expect(mapBrowserPathToInternal(publicPath)).toBe(internalPath)
    expect(publicPathToInternal(publicPath)).toBe(internalPath)
  })

  it.each([
    ["/sponsor/", "/"],
    ["/sponsor/login", "/login"],
    ["/sponsor/guide", "/guide"],
    ["/sponsor/settings", "/settings"],
    ["/sponsor/auctions", "/auctions"],
    ["/sponsor/auctions/abc123", "/auctions/abc123"],
    ["/sponsor/404", "/404"],
  ])("internal %s → public %s", (internalPath, publicPath) => {
    expect(internalPathToPublic(internalPath)).toBe(publicPath)
  })
})
