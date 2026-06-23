import {
  organisationConfig,
  sponsorshipConfig,
} from "@/config/lib/organisation"
import { formatCurrencyFromCents } from "@/plugins/sponsor/lib/sponsorship-ui"

export function sponsorTeamEmail(): string {
  return sponsorshipConfig().contacts.sponsorshipTeamEmail
}

export const SPONSOR_LOGIN_STEPS = [
  "Open the portal link",
  "Enter your email (note: this must be the same email we have on file)",
  'Request a sign in code via the "Send Code" button',
  'Enter the code in the "One-time email code" field',
  "Ensure your email is still entered if the page has refreshed",
  "Sign in (this will stay logged in for up to 30 days)",
] as const

export const SPONSOR_AUCTIONS_OVERVIEW = {
  title: "Auctions",
  body: "From the portal you should be able to see scheduled, active, and past auctions.",
  detail:
    "Each auction will have a start/end time, along with information for the type of auction it is. Some details about the competition should also be visible where the competition is not already announced.",
  formatsIntro: `Auctions will be set to one of three different formats. The auction page will say which format is being used, and this will be decided on a per-comp basis by ${organisationConfig.organisation.name}. We have tried to use standard auction terminology in case you wanted to do further research about the format. The formats are:`,
  formatItems: [
    "Sealed Bid (similar to our old system)",
    "Vickrey Auction (winner pays the value of the highest losing bid)",
    "Proxy Bidding (similar to an Ebay auction)",
  ],
} as const

export interface SponsorshipFrameworkGuide {
  summary: string
  bidding: readonly string[]
  closing: readonly string[]
  notes?: readonly string[]
}

export const SPONSORSHIP_FRAMEWORK_GUIDES = {
  first_sealed: {
    summary: "This format is most similar to our current system.",
    bidding: [
      "Each sponsor is able to submit a single hidden bid",
      "Bids can be updated, with only the latest submitted counting",
      "In the case of a tie, the earliest bid will be accepted",
      "All bids are hidden during the auction",
    ],
    closing: [
      "The highest valid bid wins, and pays the amount they bid",
      "The winning bid is revealed to all parties",
    ],
  },
  vickrey: {
    summary:
      "This is also a form of sealed bid auction, but the difference is how the final price is calculated (winner pays the value of the highest losing bid).",
    bidding: [
      "Each sponsor is able to submit a single hidden bid",
      "Bids can be updated, with only the latest submitted counting",
      "In the case of a tie, the earliest bid will be accepted",
      "All bids are hidden during the auction",
    ],
    closing: [
      "The winner pays the second-highest bid or the minimum price if they are the lone bidder",
    ],
    notes: [
      "This format allows sponsors to bid the full amount they are willing to pay as they will only have to pay the price of the highest losing bidder.",
      "The amount that the winning sponsor has bid will not be shown to other parties, only the settlement amount which is the second-highest bid/minimum price.",
    ],
  },
  ebay_proxy: {
    summary:
      "Proxy bidding runs an open bidding similar to the style of eBay auctions.",
    bidding: [
      "All bids are visible during the auction to all parties",
      "Sponsors can place a direct bid, and also a hidden maximum bid",
      "If a sponsor is outbid, when a maximum bid is set, the system will automatically bid on your behalf up to the maximum",
      "If bids are placed close to the closing time, the closing time may be extended to accommodate counter bids",
    ],
    closing: [],
    notes: [
      "Sponsors may receive emails notifying them of being outbid. These emails may take a number of minutes or not be sent at all so they are NOT a substitute for refreshing the auction page yourself.",
    ],
  },
} as const satisfies Record<
  "first_sealed" | "vickrey" | "ebay_proxy",
  SponsorshipFrameworkGuide
>

export const SPONSOR_MINIMUM_BIDS = {
  title: "Minimum bids",
  sealedAndVickrey:
    "For sealed bid and vickrey auctions, the bid must be at least the stated minimum bid.",
  proxyIntro:
    "Proxy bidding operates on a dynamic minimum bid which starts at the minimum bid and increases based on the current winning bid. The increments can be seen in the table below.",
} as const

export const SPONSOR_PROXY_BID_INCREMENTS = {
  columnHeaders: {
    range: "Current winning bid",
    increment: "Minimum increment",
  },
} as const

export interface ProxyBidIncrementRow {
  rangeLabel: string
  incrementLabel: string
}

export const PROXY_BID_INCREMENT_ROWS: readonly ProxyBidIncrementRow[] = [
  {
    rangeLabel: `${formatCurrencyFromCents(100)} to ${formatCurrencyFromCents(499)}`,
    incrementLabel: formatCurrencyFromCents(20),
  },
  {
    rangeLabel: `${formatCurrencyFromCents(500)} to ${formatCurrencyFromCents(2_499)}`,
    incrementLabel: formatCurrencyFromCents(50),
  },
  {
    rangeLabel: `${formatCurrencyFromCents(2_500)} to ${formatCurrencyFromCents(9_999)}`,
    incrementLabel: formatCurrencyFromCents(100),
  },
  {
    rangeLabel: `${formatCurrencyFromCents(10_000)} to ${formatCurrencyFromCents(24_999)}`,
    incrementLabel: formatCurrencyFromCents(250),
  },
  {
    rangeLabel: `${formatCurrencyFromCents(25_000)} to ${formatCurrencyFromCents(49_999)}`,
    incrementLabel: formatCurrencyFromCents(500),
  },
  {
    rangeLabel: `${formatCurrencyFromCents(50_000)} to ${formatCurrencyFromCents(99_999)}`,
    incrementLabel: formatCurrencyFromCents(1_000),
  },
  {
    rangeLabel: `${formatCurrencyFromCents(100_000)} to ${formatCurrencyFromCents(249_999)}`,
    incrementLabel: formatCurrencyFromCents(2_000),
  },
  {
    rangeLabel: `${formatCurrencyFromCents(250_000)} to ${formatCurrencyFromCents(499_999)}`,
    incrementLabel: formatCurrencyFromCents(5_000),
  },
  {
    rangeLabel: `${formatCurrencyFromCents(500_000)} and above`,
    incrementLabel: formatCurrencyFromCents(10_000),
  },
]

export const SPONSOR_CLOSING_AND_RESULTS = {
  title: "Closing and results",
  body: "Once an auction has ended, the system will determine the winning sponsor depending on the format of the auction. The winner will be notified and the final price will be displayed",
} as const

export function sponsorBiddingNotice() {
  const sponsorshipTeamName = sponsorshipConfig().contacts.sponsorshipTeamName

  return {
    title: "Bidding notice",
    paragraphs: [
      "Please note that all bids placed through the system are non-revokable except where allowed by the software. Failure to pay a winning bid will result in action such as exclusion from future sponsorship.",
      `If there are any technical errors or if you need any assistance, please inform ${organisationConfig.organisation.name}'s ${sponsorshipTeamName} immediately.`,
      "We are happy to answer any questions or help out if you run into any issues. You will also be able to access information relating to the auction formats and our sponsorship policy via the sponsor portal.",
    ],
  } as const
}

export function sponsorshipFrameworkGuide(
  framework: keyof typeof SPONSORSHIP_FRAMEWORK_GUIDES
): SponsorshipFrameworkGuide {
  return SPONSORSHIP_FRAMEWORK_GUIDES[framework]
}
