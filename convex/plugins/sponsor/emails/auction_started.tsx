import {
  OutcomeEmail,
  type OutcomeEmailProps,
} from "./_components/outcome_email"
import { fixtures } from "./fixtures"
import { buildOutcomeProps, type BuildEmailInput } from "./_build"

function AuctionStartedEmail(props: OutcomeEmailProps) {
  return <OutcomeEmail {...props} />
}

AuctionStartedEmail.PreviewProps = fixtures.auctionStarted
export default AuctionStartedEmail

export function buildElement(input: BuildEmailInput) {
  const props = buildOutcomeProps("auction_started", input)
  return props ? <AuctionStartedEmail {...props} /> : null
}
