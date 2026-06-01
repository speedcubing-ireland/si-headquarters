import { OutcomeEmail, type OutcomeEmailProps } from "./_components/outcome_email"
import { fixtures } from "./fixtures"
import { buildOutcomeProps, type BuildEmailInput } from "./_build"

function AuctionClosedOutbidEmail(props: OutcomeEmailProps) {
  return <OutcomeEmail {...props} />
}

AuctionClosedOutbidEmail.PreviewProps = fixtures.auctionClosedOutbid
export default AuctionClosedOutbidEmail

export function buildElement(input: BuildEmailInput) {
  const props = buildOutcomeProps("auction_closed_outbid", input)
  return props ? <AuctionClosedOutbidEmail {...props} /> : null
}
