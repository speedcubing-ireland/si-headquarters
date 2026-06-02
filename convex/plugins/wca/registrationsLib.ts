import type { RegistrationDataV2 } from "@/convex/plugins/wca/openapiClient/types.gen"

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
