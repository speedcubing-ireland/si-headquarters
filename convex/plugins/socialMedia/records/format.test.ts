import { describe, expect, test } from "vitest"
import {
  formatWcaResult,
  recordKind,
  recordLabel,
  roundLabel,
  roundOrder,
} from "@/convex/plugins/socialMedia/records/format"

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

describe("record labels", () => {
  test("treats every continental marker as a CR and keeps the continent", () => {
    expect(recordKind("NR")).toBe("NR")
    expect(recordKind("WR")).toBe("WR")
    for (const marker of ["ER", "AsR", "NAR", "SAR", "AfR", "OcR"]) {
      expect(recordKind(marker)).toBe("CR")
    }
    expect(recordLabel("NR")).toBe("NR")
    expect(recordLabel("WR")).toBe("WR")
    expect(recordLabel("ER")).toBe("CR (ER)")
  })

  test("names combined rounds like their plain counterparts", () => {
    expect(roundLabel("f")).toBe("Final")
    expect(roundLabel("c")).toBe("Final")
    expect(roundLabel("1")).toBe("First round")
    expect(roundLabel("d")).toBe("First round")
    expect(roundLabel("?")).toBe("Round")
  })

  test("orders rounds as they are held, unknown ones last", () => {
    expect(roundOrder("1")).toBeLessThan(roundOrder("d"))
    expect(roundOrder("d")).toBeLessThan(roundOrder("2"))
    expect(roundOrder("c")).toBeLessThan(roundOrder("?"))
  })
})
