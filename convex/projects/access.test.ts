import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  addUserToTeam,
  insertBlankProject,
  insertTestUser,
  seedVolunteerTestUser,
} from "@/convex/testHelpers"
import { TEAM_NAMES } from "@/convex/permissions/shared"

describe("project access", () => {
  test("volunteers can read global projects but not update them", async () => {
    const t = convexTest(schema, modules)
    const { volunteerId, memberId, projectId } = await t.run(async (ctx) => {
      const volunteerId = await seedVolunteerTestUser(ctx, "Volunteer")
      const memberId = await insertTestUser(ctx, "Project Member")
      const projectId = await insertBlankProject(ctx)
      await ctx.db.insert("projectMembers", {
        projectId,
        member: { type: "users", id: memberId },
      })
      return { volunteerId, memberId, projectId }
    })

    await expect(
      t
        .withIdentity({ subject: volunteerId })
        .query(api.projects.queries.getPageRoot, { id: projectId })
    ).resolves.toMatchObject({
      _id: projectId,
      canUpdate: false,
    })

    await expect(
      t
        .withIdentity({ subject: volunteerId })
        .mutation(api.projects.mutations.setDetails, {
          id: projectId,
          name: "Changed by volunteer",
          description: null,
        })
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })

    await expect(
      t
        .withIdentity({ subject: memberId })
        .query(api.projects.queries.getPageRoot, { id: projectId })
    ).resolves.toMatchObject({
      _id: projectId,
      canUpdate: true,
    })
  })

  test("team members can read team projects but only members can update", async () => {
    const t = convexTest(schema, modules)
    const { teamMemberId, projectMemberId, projectId } = await t.run(
      async (ctx) => {
        const teamMemberId = await insertTestUser(ctx, "Team Member")
        const projectMemberId = await insertTestUser(ctx, "Project Member")
        await addUserToTeam(ctx, teamMemberId, TEAM_NAMES.GRAPHICS)
        const team = await ctx.db
          .query("teams")
          .withIndex("by_name", (q) => q.eq("name", TEAM_NAMES.GRAPHICS))
          .unique()
        if (team === null) throw new Error("Team not found")
        const projectId = await insertBlankProject(ctx, {
          type: "teams",
          id: team._id,
        })
        await ctx.db.insert("projectMembers", {
          projectId,
          member: { type: "users", id: projectMemberId },
        })
        return { teamMemberId, projectMemberId, projectId }
      }
    )

    await expect(
      t
        .withIdentity({ subject: teamMemberId })
        .query(api.projects.queries.getPageRoot, { id: projectId })
    ).resolves.toMatchObject({
      _id: projectId,
      canUpdate: false,
    })

    await expect(
      t
        .withIdentity({ subject: teamMemberId })
        .mutation(api.projects.mutations.setStatus, {
          id: projectId,
          status: "active",
        })
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })

    await expect(
      t
        .withIdentity({ subject: projectMemberId })
        .mutation(api.projects.mutations.setStatus, {
          id: projectId,
          status: "active",
        })
    ).resolves.toBeNull()
  })

  test("only leads and directors can delete projects", async () => {
    const t = convexTest(schema, modules)
    const { leadId, memberId, projectId } = await t.run(async (ctx) => {
      const leadId = await insertTestUser(ctx, "Project Lead")
      const memberId = await insertTestUser(ctx, "Project Member")
      const projectId = await insertBlankProject(ctx)
      await ctx.db.patch("projects", projectId, { leadUserId: leadId })
      await ctx.db.insert("projectMembers", {
        projectId,
        member: { type: "users", id: memberId },
      })
      return { leadId, memberId, projectId }
    })

    await expect(
      t
        .withIdentity({ subject: memberId })
        .mutation(api.projects.mutations.deleteProject, { id: projectId })
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })

    await expect(
      t
        .withIdentity({ subject: leadId })
        .mutation(api.projects.mutations.deleteProject, { id: projectId })
    ).resolves.toBeNull()
  })

  test("member options require update access", async () => {
    const t = convexTest(schema, modules)
    const { volunteerId, memberId, projectId } = await t.run(async (ctx) => {
      const volunteerId = await seedVolunteerTestUser(ctx, "Volunteer")
      const memberId = await insertTestUser(ctx, "Project Member")
      // The member needs to be able to read users and teams to see member options,
      // which requires the Volunteer team.
      await addUserToTeam(ctx, memberId, TEAM_NAMES.VOLUNTEER)
      const projectId = await insertBlankProject(ctx)
      await ctx.db.insert("projectMembers", {
        projectId,
        member: { type: "users", id: memberId },
      })
      return { volunteerId, memberId, projectId }
    })

    await expect(
      t
        .withIdentity({ subject: volunteerId })
        .query(api.projects.queries.listMemberOptions, { id: projectId })
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })

    const options = await t
      .withIdentity({ subject: memberId })
      .query(api.projects.queries.listMemberOptions, { id: projectId })

    expect(options.users.length).toBeGreaterThan(0)
    expect(Array.isArray(options.teams)).toBe(true)
  })
})
