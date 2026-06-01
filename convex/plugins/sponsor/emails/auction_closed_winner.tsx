import { OutcomeEmail, type OutcomeEmailProps } from "./_components/outcome_email"
import { fixtures } from "./fixtures"
import { buildOutcomeProps, type BuildEmailInput } from "./_build"

function AuctionClosedWinnerEmail(props: OutcomeEmailProps) {
  return <OutcomeEmail {...props} />
}

AuctionClosedWinnerEmail.PreviewProps = fixtures.auctionClosedWinner
export default AuctionClosedWinnerEmail

export function buildElement(input: BuildEmailInput) {
  const props = buildOutcomeProps("auction_closed_winner", input)
  return props ? <AuctionClosedWinnerEmail {...props} /> : null
}
