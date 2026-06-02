import { describe, expect, test } from "vitest"
import {
  isPlainObject,
  readBoolean,
  readJsonObject,
  readNumber,
  readRecord,
  readString,
} from "@/convex/plugins/core/jsonBoundary"

describe("jsonBoundary", () => {
  test("readString returns only string fields", () => {
    const record = { name: "Spring Open", count: 3 }
    expect(readString(record, "name")).toBe("Spring Open")
    expect(readString(record, "count")).toBeUndefined()
  })

  test("readRecord ignores arrays", () => {
    const record = { nested: { ok: true }, list: [] }
    expect(readRecord(record, "nested")).toEqual({ ok: true })
    expect(readRecord(record, "list")).toBeUndefined()
  })

  test("readJsonObject rejects non-object bodies", async () => {
    const response = new Response(JSON.stringify(["not", "an", "object"]), {
      headers: { "Content-Type": "application/json" },
    })
    expect(await readJsonObject(response)).toBeNull()
  })

  test("readBoolean and readNumber stay typed", () => {
    const record = { enabled: true, total: 4 }
    expect(readBoolean(record, "enabled")).toBe(true)
    expect(readNumber(record, "total")).toBe(4)
    expect(isPlainObject(record)).toBe(true)
  })
})
