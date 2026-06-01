import {
  LifecycleEmail,
  type LifecycleEmailProps,
} from "./_components/lifecycle_email"
import { fixtures } from "./fixtures"
import { buildLifecycleProps, type BuildEmailInput } from "./_build"

function AuctionScheduledEmail(props: LifecycleEmailProps) {
  return <LifecycleEmail {...props} />
}

AuctionScheduledEmail.PreviewProps = fixtures.auctionScheduled
export default AuctionScheduledEmail

export function buildElement(input: BuildEmailInput) {
  const props = buildLifecycleProps("auction_scheduled", input)
  return props ? <AuctionScheduledEmail {...props} /> : null
}
