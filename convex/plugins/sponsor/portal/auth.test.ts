import { describe, expect, test } from "vitest"
import { api, components } from "@/convex/_generated/api"
import {
  createSponsorTestHarness,
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
    const sponsorAuthUserResult: unknown = await t.query(
      components.sponsorAuth.adapter.findOne,
      {
        model: "user",
        where: [{ field: "_id", value: sponsorAuthUserId }],
      }
    )
    const sponsorAuthUserName = (() => {
      if (
        typeof sponsorAuthUserResult !== "object" ||
        sponsorAuthUserResult === null
      ) {
        return undefined
      }
      const name = (sponsorAuthUserResult as Record<string, unknown>).name
      return typeof name === "string" ? name : undefined
    })()

    expect(me?.name).toBe("Updated Portal Name")
    expect(sponsorDoc?.name).toBe("Canonical Sponsor Ltd")
    expect(sponsorAuthUserName).toBe("Updated Portal Name")
  })
})
