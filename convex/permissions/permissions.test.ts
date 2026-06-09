import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import {
  addUserToTeam,
  insertBlankCompetition,
  insertBlankProject,
  insertTestUser,
} from "@/convex/testHelpers"
import {
  deriveTaskRootContextFromParent,
  taskRootPatch,
} from "@/convex/tasks/hierarchy"
import { modules } from "@/convex/test.setup"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

function permissionKey(permission: { action: string; subject: string }) {
  return `${permission.action}:${permission.subject}`
}

describe("permissions", () => {
  test("current permissions reflect team grants", async () => {
    const t = convexTest(schema, modules)
    const ids = await t.run(async (ctx) => {
      const volunteerId = await insertTestUser(ctx, "Volunteer")
      const directorId = await insertTestUser(ctx, "Director")
      const competitionTeamId = await insertTestUser(ctx, "Competition Team")
      const financeId = await insertTestUser(ctx, "Finance")

      await addUserToTeam(ctx, volunteerId, TEAM_NAMES.VOLUNTEER)
      await addUserToTeam(ctx, directorId, TEAM_NAMES.DIRECTORS)
      await addUserToTeam(ctx, competitionTeamId, TEAM_NAMES.COMPETITIONS)
      await addUserToTeam(ctx, financeId, TEAM_NAMES.FINANCE)

      return { volunteerId, directorId, competitionTeamId, financeId }
    })

    const [unauth, volunteer, director, competitions, finance] =
      await Promise.all([
        t.query(api.permissions.queries.currentPermissions, {}),
        t
          .withIdentity({ subject: ids.volunteerId })
          .query(api.permissions.queries.currentPermissions, {}),
        t
          .withIdentity({ subject: ids.directorId })
          .query(api.permissions.queries.currentPermissions, {}),
        t
          .withIdentity({ subject: ids.competitionTeamId })
          .query(api.permissions.queries.currentPermissions, {}),
        t
          .withIdentity({ subject: ids.financeId })
          .query(api.permissions.queries.currentPermissions, {}),
      ])

    expect(unauth.permissions).toEqual([])
    expect(volunteer.permissions.map(permissionKey)).toEqual(
      expect.arrayContaining([
        "manage:Competition",
        "read:Project",
        "create:Project",
        "read:Team",
        "read:User",
        "manage:Task",
      ])
    )
    expect(director.permissions.map(permissionKey)).toEqual(
      expect.arrayContaining([
        "manage:all",
        "manage:UserManagement",
        "access:SponsorPortalAdmin",
      ])
    )
    expect(competitions.permissions.map(permissionKey)).toEqual(
      expect.arrayContaining(["manage:Competition", "read:User"])
    )
    expect(finance.permissions.map(permissionKey)).toEqual([
      "access:SponsorPortalAdmin",
    ])
  })

  test("disabled users are denied by active-user gates", async () => {
    const t = convexTest(schema, modules)
    const disabledId = await t.run(async (ctx) => {
      const userId = await insertTestUser(ctx, "Disabled Director")
      await addUserToTeam(ctx, userId, TEAM_NAMES.DIRECTORS)
      await ctx.db.patch("users", userId, { disabled: true })
      return userId
    })
    const disabled = t.withIdentity({ subject: disabledId })

    await expect(
      disabled.query(api.phases.queries.list, {})
    ).rejects.toMatchObject({
      data: { code: "UNAUTHENTICATED" },
    })
    await expect(
      disabled.query(api.permissions.queries.currentPermissions, {})
    ).resolves.toEqual({ permissions: [] })
  })

  test("organisers without teams can only read competitions they organise", async () => {
    const t = convexTest(schema, modules)
    const { organiserId, organisedCompetitionId } = await t.run(async (ctx) => {
      const organiserId = await insertTestUser(ctx, "Organiser")
      const organisedCompetitionId = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", organisedCompetitionId, {
        name: "Organised Open",
        people: {
          compLead: null,
          leadDelegate: null,
          organisers: [organiserId],
        },
      })
      const hiddenCompetitionId = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", hiddenCompetitionId, {
        name: "Hidden Open",
      })
      return { organiserId, organisedCompetitionId }
    })

    const competitions = await t
      .withIdentity({ subject: organiserId })
      .query(api.competitions.queries.list, {})

    expect(competitions).toEqual([
      {
        _id: organisedCompetitionId,
        name: "Organised Open",
      },
    ])
  })

  test("competitions team can list users for competition people pickers", async () => {
    const t = convexTest(schema, modules)
    const { managerId, competitionId, otherUserId } = await t.run(
      async (ctx) => {
        const managerId = await insertTestUser(ctx, "Manager")
        const otherUserId = await insertTestUser(ctx, "Other")
        await addUserToTeam(ctx, managerId, TEAM_NAMES.COMPETITIONS)
        const competitionId = await insertBlankCompetition(ctx)
        return { managerId, competitionId, otherUserId }
      }
    )

    const users = await t
      .withIdentity({ subject: managerId })
      .query(api.users.queries.listForCompetition, { competitionId })

    expect(users.map((user) => user._id)).toContain(otherUserId)
  })

  test("project user members can read and update projects", async () => {
    const t = convexTest(schema, modules)
    const { memberId, outsiderId, projectId } = await t.run(async (ctx) => {
      const memberId = await insertTestUser(ctx, "Project Member")
      const outsiderId = await insertTestUser(ctx, "Outsider")
      const projectId = await insertBlankProject(ctx)
      await ctx.db.insert("projectMembers", {
        projectId,
        member: { type: "users", id: memberId },
      })
      return { memberId, outsiderId, projectId }
    })

    await expect(
      t
        .withIdentity({ subject: outsiderId })
        .query(api.projects.queries.getPageRoot, { id: projectId })
    ).resolves.toBeNull()

    await expect(
      t
        .withIdentity({ subject: memberId })
        .query(api.projects.queries.getPageRoot, { id: projectId })
    ).resolves.toMatchObject({ _id: projectId })

    await expect(
      t
        .withIdentity({ subject: memberId })
        .mutation(api.projects.mutations.setDetails, {
          id: projectId,
          name: "Updated project",
          description: null,
        })
    ).resolves.toBeNull()
  })

  test("project team members can read and update projects", async () => {
    const t = convexTest(schema, modules)
    const { teamMemberId, outsiderId, projectId } = await t.run(async (ctx) => {
      const teamMemberId = await insertTestUser(ctx, "Project Team Member")
      const outsiderId = await insertTestUser(ctx, "Outsider")
      await addUserToTeam(ctx, teamMemberId, TEAM_NAMES.GRAPHICS)
      const team = await ctx.db
        .query("teams")
        .withIndex("by_name", (q) => q.eq("name", TEAM_NAMES.GRAPHICS))
        .unique()
      if (team === null) throw new Error("Team not found")
      const projectId = await insertBlankProject(ctx)
      await ctx.db.insert("projectMembers", {
        projectId,
        member: { type: "teams", id: team._id },
      })
      return { teamMemberId, outsiderId, projectId }
    })

    await expect(
      t
        .withIdentity({ subject: outsiderId })
        .mutation(api.projects.mutations.setStatus, {
          id: projectId,
          status: "active",
        })
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })

    await expect(
      t
        .withIdentity({ subject: teamMemberId })
        .mutation(api.projects.mutations.setStatus, {
          id: projectId,
          status: "active",
        })
    ).resolves.toBeNull()
  })

  test("organisers without teams cannot list users globally", async () => {
    const t = convexTest(schema, modules)
    const organiserId = await t.run(async (ctx) => {
      const organiserId = await insertTestUser(ctx, "Organiser")
      const competitionId = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", competitionId, {
        people: {
          compLead: null,
          leadDelegate: null,
          organisers: [organiserId],
        },
      })
      return organiserId
    })

    await expect(
      t.withIdentity({ subject: organiserId }).query(api.users.queries.list, {})
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })
  })

  test("disabled users cannot mutate tasks", async () => {
    const t = convexTest(schema, modules)
    const { disabledId, taskId } = await t.run(async (ctx) => {
      const userId = await insertTestUser(ctx, "Disabled Volunteer")
      await addUserToTeam(ctx, userId, TEAM_NAMES.VOLUNTEER)
      await ctx.db.patch("users", userId, { disabled: true })
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await ctx.db.insert("phases", {
        name: "Phase",
        color: "gray",
        owner: { type: "competitions", id: competitionId },
        sortKey: "a0",
      })
      const parent = { type: "phases", id: phaseId } as const
      const taskId = await ctx.db.insert("tasks", {
        name: "Blocked task",
        description: null,
        parent,
        ...taskRootPatch(await deriveTaskRootContextFromParent(ctx, parent)),
        kind: "standard",
        status: "backlog",
        statusIntent: { type: "manual", status: "backlog" },
        order: "a0",
        dueDate: null,
        assigneeIds: null,
        owner: null,
      })
      return { disabledId: userId, taskId }
    })

    await expect(
      t
        .withIdentity({ subject: disabledId })
        .mutation(api.tasks.mutations.setTaskDetails, {
          id: taskId,
          name: "Nope",
          description: null,
        })
    ).rejects.toMatchObject({
      data: { code: "UNAUTHENTICATED" },
    })
  })
})
