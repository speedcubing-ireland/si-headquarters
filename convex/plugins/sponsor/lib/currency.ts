import { sponsorshipConfig } from "@/config/lib/organisation"

export function defaultSponsorshipCurrency(): string {
  return sponsorshipConfig().sponsorship.defaultCurrency
}

export function formatSponsorshipAmount(cents: number): string {
  return `${defaultSponsorshipCurrency()} ${(cents / 100).toFixed(2)}`
}
