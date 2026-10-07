import {
  organisationConfig,
  sponsorshipConfig,
} from "@/config/lib/organisation"

// Copy-generation readers must not load the React email rendering stack.
export function formatEmailDateTime(timestamp: number): string {
  const { locale, timeZone, timeZoneLabel } = organisationConfig.regional
  const date = new Date(timestamp)
  const formatted = date.toLocaleString(locale, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  })
  const timeZoneName =
    new Intl.DateTimeFormat(locale, {
      timeZone,
      timeZoneName: "longGeneric",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? timeZoneLabel
  return `${formatted} (${timeZoneName})`
}

export function formatMoney(
  cents: number,
  currency = sponsorshipConfig().sponsorship.defaultCurrency
): string {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

export function formatRecipientSubtitle(
  recipientName: string | undefined,
  messageForNamed: (name: string) => string,
  messageAnonymous: string
): string {
  if (recipientName !== undefined && recipientName.length > 0) {
    return messageForNamed(recipientName)
  }
  return messageAnonymous
}
