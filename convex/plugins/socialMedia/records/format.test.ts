import { describe, expect, test } from "vitest"
import { formatWcaResult } from "@/convex/plugins/socialMedia/records/format"

describe("formatWcaResult", () => {
  test("prints times the way the WCA does", () => {
    expect(formatWcaResult("333", "single", 987)).toBe("9.87")
    expect(formatWcaResult("333", "average", 1005)).toBe("10.05")
    expect(formatWcaResult("666", "average", 6234)).toBe("1:02.34")
    expect(formatWcaResult("555bf", "single", 360500)).toBe("1:00:05.00")
  })

  test("prints fewest moves as moves, with a two-decimal average", () => {
    expect(formatWcaResult("333fm", "single", 22)).toBe("22")
    expect(formatWcaResult("333fm", "average", 2433)).toBe("24.33")
  })

  test("decodes multi-blind's packed points, time and misses", () => {
    // 41/42 in 54:14: 40 points, 3254 seconds, 1 missed.
    expect(formatWcaResult("333mbf", "single", 590325401)).toBe("41/42 54:14")
    // 2/2 in 59 seconds.
    expect(formatWcaResult("333mbf", "single", 970005900)).toBe("2/2 0:59")
  })

  test("names results that are not attempts", () => {
    expect(formatWcaResult("333", "single", -1)).toBe("DNF")
    expect(formatWcaResult("333", "single", -2)).toBe("DNS")
    expect(formatWcaResult("333", "single", 0)).toBe("")
  })
})
