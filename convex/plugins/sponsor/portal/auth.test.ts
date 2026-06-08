import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import {
  createSponsorTestHarness,
  getSponsorAuthUser,
  seedSponsorSession,
} from "@/convex/plugins/sponsor/testing/sponsorHarness.test"

describe("sponsor portal profile auth", () => {
  test("display name updates auth profile without mutating sponsor name", async () => {
    const t = createSponsorTestHarness()
    const { sessionToken, sponsorId, sponsorAuthUserId } =
      await seedSponsorSession(t, {
        email: "sponsor@example.com",
        name: "Canonical Sponsor",
      })

    await t.mutation(api.plugins.sponsor.portal.auth.updateDisplayName, {
      sessionToken,
      displayName: "Updated Portal Name",
    })

    const [me, sponsorDoc] = await Promise.all([
      t.query(api.plugins.sponsor.portal.auth.me, { sessionToken }),
      t.run((ctx) => ctx.db.get("sponsors", sponsorId)),
    ])
    const sponsorAuthUser = await getSponsorAuthUser(t, sponsorAuthUserId)

    expect(me?.sponsor.name).toBe("Updated Portal Name")
    expect(sponsorDoc?.name).toBe("Canonical Sponsor Ltd")
    expect(sponsorAuthUser?.name).toBe("Updated Portal Name")
  })
})
