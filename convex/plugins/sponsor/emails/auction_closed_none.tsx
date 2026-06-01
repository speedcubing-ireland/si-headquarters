import { OutcomeEmail, type OutcomeEmailProps } from "./_components/outcome_email"
import { fixtures } from "./fixtures"
import { buildOutcomeProps, type BuildEmailInput } from "./_build"

function AuctionClosedNoneEmail(props: OutcomeEmailProps) {
  return <OutcomeEmail {...props} />
}

AuctionClosedNoneEmail.PreviewProps = fixtures.auctionClosedNone
export default AuctionClosedNoneEmail

export function buildElement(input: BuildEmailInput) {
  const props = buildOutcomeProps("auction_closed_none", input)
  return props ? <AuctionClosedNoneEmail {...props} /> : null
}
