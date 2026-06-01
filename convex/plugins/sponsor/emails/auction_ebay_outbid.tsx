import {
  LifecycleEmail,
  type LifecycleEmailProps,
} from "./_components/lifecycle_email"
import { fixtures } from "./fixtures"
import { buildLifecycleProps, type BuildEmailInput } from "./_build"

function AuctionEbayOutbidEmail(props: LifecycleEmailProps) {
  return <LifecycleEmail {...props} />
}

AuctionEbayOutbidEmail.PreviewProps = fixtures.auctionEbayOutbid
export default AuctionEbayOutbidEmail

export function buildElement(input: BuildEmailInput) {
  const props = buildLifecycleProps("auction_ebay_outbid", input)
  return props ? <AuctionEbayOutbidEmail {...props} /> : null
}
