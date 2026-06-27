import type { RegistrationDataV2 } from "@/convex/plugins/wca/openapiClient/types.gen"

export function parseDateOnlyToUtcMs(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function firstNameFromFullName(name: string): string {
  const [firstName = ""] = name.trim().split(/\s+/)
  return firstName
}

export function normalizeWcaId(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase()
}

export function getRegistrationStatus(
  registration: RegistrationDataV2
): string {
  return (registration.competing.registration_status ?? "").trim()
}

export function isAcceptedRegistration(
  registration: RegistrationDataV2
): boolean {
  return getRegistrationStatus(registration).toLowerCase() === "accepted"
}

export function hasPaid(registration: RegistrationDataV2): boolean {
  if (registration.payment?.has_paid === true) {
    return true
  }
  const paymentStatus = (registration.payment?.payment_status ?? "")
    .trim()
    .toLowerCase()
  return paymentStatus === "paid"
}
