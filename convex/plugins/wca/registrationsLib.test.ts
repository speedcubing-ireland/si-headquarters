import { describe, expect, it } from "vitest"
import type { RegistrationDataV2 } from "@/convex/plugins/wca/openapiClient/types.gen"
import {
  firstNameFromFullName,
  getRegistrationStatus,
  hasPaid,
  isAcceptedRegistration,
  normalizeWcaId,
  parseDateOnlyToUtcMs,
} from "./registrationsLib"

function makeReg(
  status: string | undefined,
  payment?: { has_paid?: boolean; payment_status?: string }
): RegistrationDataV2 {
  return {
    id: 1,
    registrant_id: 10,
    user_id: 100,
    user: {
      id: 100,
      name: "Test User",
      gender: "m",
      country_iso2: "IE",
      wca_id: "2020TEST01",
    },
    competing: { event_ids: ["333"], registration_status: status },
    payment,
  }
}

describe("parseDateOnlyToUtcMs", () => {
  it("parses a valid date string to UTC milliseconds", () => {
    expect(parseDateOnlyToUtcMs("2024-01-15")).toBe(Date.UTC(2024, 0, 15))
  })

  it("parses a date with surrounding whitespace", () => {
    expect(parseDateOnlyToUtcMs("  2024-03-20  ")).toBe(Date.UTC(2024, 2, 20))
  })

  it("uses 1-based month indexing in the string (December = 12)", () => {
    expect(parseDateOnlyToUtcMs("2024-12-01")).toBe(Date.UTC(2024, 11, 1))
  })

  it("returns null for slash-separated format", () => {
    expect(parseDateOnlyToUtcMs("2024/01/15")).toBeNull()
  })

  it("returns null for compact format without separators", () => {
    expect(parseDateOnlyToUtcMs("20240115")).toBeNull()
  })

  it("returns null for human-readable format", () => {
    expect(parseDateOnlyToUtcMs("Jan 15 2024")).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(parseDateOnlyToUtcMs("")).toBeNull()
  })
})

describe("firstNameFromFullName", () => {
  it("returns the first word of a full name", () => {
    expect(firstNameFromFullName("John Smith")).toBe("John")
  })

  it("handles multiple name parts", () => {
    expect(firstNameFromFullName("Mary Jane Watson")).toBe("Mary")
  })

  it("handles multiple spaces between words", () => {
    expect(firstNameFromFullName("Bob  Jones")).toBe("Bob")
  })

  it("trims leading and trailing whitespace", () => {
    expect(firstNameFromFullName("  Alice  ")).toBe("Alice")
  })

  it("returns the only word when there is no surname", () => {
    expect(firstNameFromFullName("Cher")).toBe("Cher")
  })

  it("returns empty string for empty input", () => {
    expect(firstNameFromFullName("")).toBe("")
  })

  it("returns empty string for whitespace-only input", () => {
    expect(firstNameFromFullName("   ")).toBe("")
  })
})

describe("normalizeWcaId", () => {
  it("uppercases a lowercase WCA ID", () => {
    expect(normalizeWcaId("2020test01")).toBe("2020TEST01")
  })

  it("trims surrounding whitespace", () => {
    expect(normalizeWcaId("  2020TEST01  ")).toBe("2020TEST01")
  })

  it("returns empty string for null", () => {
    expect(normalizeWcaId(null)).toBe("")
  })

  it("returns empty string for undefined", () => {
    expect(normalizeWcaId(undefined)).toBe("")
  })

  it("returns empty string for empty string", () => {
    expect(normalizeWcaId("")).toBe("")
  })

  it("leaves an already-normalized ID unchanged", () => {
    expect(normalizeWcaId("2020TEST01")).toBe("2020TEST01")
  })
})

describe("getRegistrationStatus", () => {
  it("returns the registration status string", () => {
    expect(getRegistrationStatus(makeReg("accepted"))).toBe("accepted")
  })

  it("trims surrounding whitespace from status", () => {
    expect(getRegistrationStatus(makeReg("  pending  "))).toBe("pending")
  })

  it("returns empty string when status is undefined", () => {
    expect(getRegistrationStatus(makeReg(undefined))).toBe("")
  })
})

describe("isAcceptedRegistration", () => {
  it("returns true for lowercase accepted status", () => {
    expect(isAcceptedRegistration(makeReg("accepted"))).toBe(true)
  })

  it("is case-insensitive (Accepted)", () => {
    expect(isAcceptedRegistration(makeReg("Accepted"))).toBe(true)
  })

  it("is case-insensitive (ACCEPTED)", () => {
    expect(isAcceptedRegistration(makeReg("ACCEPTED"))).toBe(true)
  })

  it("returns false for pending status", () => {
    expect(isAcceptedRegistration(makeReg("pending"))).toBe(false)
  })

  it("returns false for cancelled status", () => {
    expect(isAcceptedRegistration(makeReg("cancelled"))).toBe(false)
  })

  it("returns false when status is undefined", () => {
    expect(isAcceptedRegistration(makeReg(undefined))).toBe(false)
  })
})

describe("hasPaid", () => {
  it("returns true when has_paid is true", () => {
    expect(hasPaid(makeReg("accepted", { has_paid: true }))).toBe(true)
  })

  it("returns false when has_paid is false", () => {
    expect(hasPaid(makeReg("accepted", { has_paid: false }))).toBe(false)
  })

  it("returns true when payment_status is 'paid'", () => {
    expect(hasPaid(makeReg("accepted", { payment_status: "paid" }))).toBe(true)
  })

  it("is case-insensitive for payment_status (PAID)", () => {
    expect(hasPaid(makeReg("accepted", { payment_status: "PAID" }))).toBe(true)
  })

  it("is case-insensitive for payment_status (Paid)", () => {
    expect(hasPaid(makeReg("accepted", { payment_status: "Paid" }))).toBe(true)
  })

  it("trims whitespace from payment_status", () => {
    expect(hasPaid(makeReg("accepted", { payment_status: "  paid  " }))).toBe(
      true
    )
  })

  it("returns false when payment_status is a non-paid value", () => {
    expect(hasPaid(makeReg("accepted", { payment_status: "unpaid" }))).toBe(
      false
    )
  })

  it("returns false when payment object is absent", () => {
    expect(hasPaid(makeReg("accepted"))).toBe(false)
  })

  it("prefers has_paid:true over a non-paid payment_status", () => {
    expect(
      hasPaid(makeReg("accepted", { has_paid: true, payment_status: "unpaid" }))
    ).toBe(true)
  })
})
