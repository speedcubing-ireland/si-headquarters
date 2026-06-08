import { convexTest, type TestConvex } from "convex-test"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"

export type SponsorAuctionTestHarness = TestConvex<typeof schema>

export function createSponsorAuctionTestHarness(): SponsorAuctionTestHarness {
  return convexTest(schema, modules)
}
