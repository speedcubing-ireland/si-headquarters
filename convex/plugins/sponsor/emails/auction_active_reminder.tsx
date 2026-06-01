import {
  LifecycleEmail,
  type LifecycleEmailProps,
} from "./_components/lifecycle_email"
import { fixtures } from "./fixtures"
import { buildLifecycleProps, type BuildEmailInput } from "./_build"

function AuctionActiveReminderEmail(props: LifecycleEmailProps) {
  return <LifecycleEmail {...props} />
}

AuctionActiveReminderEmail.PreviewProps = fixtures.auctionActiveReminder
export default AuctionActiveReminderEmail

export function buildElement(input: BuildEmailInput) {
  const props = buildLifecycleProps("auction_active_reminder", input)
  return props ? <AuctionActiveReminderEmail {...props} /> : null
}
