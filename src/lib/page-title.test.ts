import { describe, expect, it } from "vitest"
import { getPageTitle } from "./page-title"

import { headquartersPageTitle } from "./page-title"

const HQ = "Headquarters | Speedcubing Ireland"
const SP = "Sponsors | Speedcubing Ireland"

describe("getPageTitle", () => {
  it.each([
    ["/", HQ],
    ["/tasks", headquartersPageTitle("Tasks")],
    ["/teams/abc123/tasks", headquartersPageTitle("Team Tasks")],
    ["/competitions", HQ],
    ["/admin/sponsorship", HQ],
    ["/sponsors", HQ],
    ["/sponsor", SP],
    ["/sponsor/", SP],
    ["/sponsor/login", SP],
    ["/sponsor/auctions/123", SP],
    ["/sponsor/settings", SP],
  ])("%s → %s", (pathname, expected) => {
    expect(getPageTitle(pathname)).toBe(expected)
  })
})
