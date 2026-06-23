import { organisationConfig } from "@/config/lib/organisation"

export const DEFAULT_SPONSORSHIP_CURRENCY =
  organisationConfig.sponsorship.defaultCurrency

export function formatSponsorshipAmount(cents: number): string {
  return `${DEFAULT_SPONSORSHIP_CURRENCY} ${(cents / 100).toFixed(2)}`
}
