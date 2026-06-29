import { defineSchema, defineTable } from "convex/server"
import { authTables } from "@convex-dev/auth/server"
import { v } from "convex/values"
import { competitionsCoreFields } from "@/convex/competitions/validators"
import {
  projectMemberFields,
  projectsFields,
} from "@/convex/projects/validators"
import { competitionWeekendSlotFields } from "@/convex/competitions/weekendSlots/validators"
import { competitionOrganiserInvitesTable } from "@/convex/competitions/invites/validators"
import { impersonationSessionsTable } from "@/convex/impersonation/validators"
import { subscriptionsFields } from "@/convex/subscriptions/validators"
import { usersFields } from "@/convex/users/validators"
import { phasesFields } from "@/convex/phases/validators"
import {
  teamDiscordChannelFields,
  teamMembershipFields,
  teamsFields,
} from "@/convex/teams/validators"
import { tasksFields } from "@/convex/tasks/validators"
import {
  taskLabelAssignments,
  taskLabelsFields,
} from "@/convex/tasks/labels/validators"
import {
  taskReviewerFields,
  taskReviewOverrideFields,
} from "@/convex/tasks/reviews/validators"
import { taskBlockersFields } from "@/convex/tasks/blockers/validators"
import { savedViewFields } from "@/convex/views/validators"
import { pluginTables } from "@/convex/plugins/registry"
import {
  taskNudgeCooldownFields,
  taskReminderFields,
} from "@/convex/notifications/validators"
import { objectUpdatesFields } from "@/convex/updates/validators"
import { refundVolunteerFields } from "@/convex/refunds/validators"
import {
  eventScheduleSnapshotFields,
  wcaEventSnapshotFields,
} from "@/convex/events/validators"

const schema = defineSchema(
  {
    ...authTables,
    authSessions: defineTable({
      userId: v.id("users"),
      expirationTime: v.number(),
      impersonationSessionId: v.optional(v.id("impersonationSessions")),
      impersonatedByUserId: v.optional(v.id("users")),
      impersonationExpiresAt: v.optional(v.number()),
    }).index("userId", ["userId"]),
    users: defineTable(usersFields)
      .index("email", ["email"])
      .index("phone", ["phone"])
      .index("by_discordUserId", ["discordUserId"])
      .index("by_wcaUserId", ["wcaUserId"])
      .searchIndex("search_name", { searchField: "name" }),
    teams: defineTable(teamsFields).index("by_name", ["name"]),
    teamMemberships: defineTable(teamMembershipFields)
      .index("by_userId", ["userId"])
      .index("by_teamId_and_userId", ["teamId", "userId"]),
    teamDiscordChannels: defineTable(teamDiscordChannelFields).index(
      "by_teamId",
      ["teamId"]
    ),
    competitions: defineTable(competitionsCoreFields).index(
      "by_wcaCompetitionId",
      ["wcaCompetitionId"]
    ),
    eventScheduleSnapshots: defineTable(eventScheduleSnapshotFields).index(
      "by_sheetId",
      ["sheetId"]
    ),
    wcaEventSnapshots: defineTable(wcaEventSnapshotFields).index(
      "by_wcaCompetitionId",
      ["wcaCompetitionId"]
    ),
    competitionOrganiserInvites: competitionOrganiserInvitesTable,
    projects: defineTable(projectsFields)
      .index("by_scope_type", ["scope.type"])
      .index("by_scope_type_and_scope_id", ["scope.type", "scope.id"])
      .index("by_leadUserId", ["leadUserId"]),
    projectMembers: defineTable(projectMemberFields)
      .index("by_projectId", ["projectId"])
      .index("by_projectId_and_member_type_and_member_id", [
        "projectId",
        "member.type",
        "member.id",
      ])
      .index("by_member_type_and_member_id", ["member.type", "member.id"]),
    competitionWeekendSlots: defineTable(competitionWeekendSlotFields)
      .index("by_year", ["year"])
      .index("by_year_and_weekendStart", ["year", "weekendStart"]),
    objectUpdates: defineTable(objectUpdatesFields).index(
      "by_object_type_and_object_id",
      ["object.type", "object.id"]
    ),
    subscriptions: defineTable(subscriptionsFields)
      .index("by_userId_and_object_type_and_object_id", [
        "userId",
        "object.type",
        "object.id",
      ])
      .index("by_object_type_and_object_id_and_userId", [
        "object.type",
        "object.id",
        "userId",
      ]),
    phases: defineTable(phasesFields)
      .index("by_owner_type_and_owner_id_and_sortKey", [
        "owner.type",
        "owner.id",
        "sortKey",
      ])
      .searchIndex("search_name", { searchField: "name" }),
    tasks: defineTable(tasksFields)
      .index("by_parent_type_and_parent_id_and_order", [
        "parent.type",
        "parent.id",
        "order",
      ])
      .index("by_root_type_and_root_id", ["root.type", "root.id"])
      .index("by_rootPhase_id", ["rootPhase.id"])
      .index("by_owner_type_and_owner_id", ["owner.type", "owner.id"])
      .index("by_dueDate", ["dueDate"])
      .searchIndex("search_name", { searchField: "name" }),
    taskLabels: defineTable(taskLabelsFields).index("by_code", ["code"]),
    taskLabelAssignments: defineTable(taskLabelAssignments)
      .index("by_taskId_and_labelId", ["taskId", "labelId"])
      .index("by_labelId_and_taskId", ["labelId", "taskId"]),
    taskReviewers: defineTable(taskReviewerFields)
      .index("by_taskId", ["taskId"])
      .index("by_taskId_and_reviewer_type_and_reviewer_id", [
        "taskId",
        "reviewer.type",
        "reviewer.id",
      ]),
    taskReviewOverrides: defineTable(taskReviewOverrideFields).index(
      "by_taskId",
      ["taskId"]
    ),
    taskBlockers: defineTable(taskBlockersFields)
      .index("by_blockedTaskId_and_blockingTaskId", [
        "blockedTaskId",
        "blockingTaskId",
      ])
      .index("by_blockingTaskId_and_blockedTaskId", [
        "blockingTaskId",
        "blockedTaskId",
      ]),
    taskReminders: defineTable(taskReminderFields).index(
      "by_taskId_and_userId_and_cancelledAt_and_sentAt_and_remindAt",
      ["taskId", "userId", "cancelledAt", "sentAt", "remindAt"]
    ),
    taskNudgeCooldowns: defineTable(taskNudgeCooldownFields).index(
      "by_taskId_and_assigneeId",
      ["taskId", "assigneeId"]
    ),
    notificationDueScanStates: defineTable({
      key: v.string(),
      lastRunDate: v.string(),
    }).index("by_key", ["key"]),
    savedViews: defineTable(savedViewFields)
      .index("by_owner_entity_page", ["ownerId", "entity", "pageId"])
      .index("by_visibility_entity_page", ["visibility", "entity", "pageId"]),
    impersonationSessions: impersonationSessionsTable,
    refundVolunteers: defineTable(refundVolunteerFields)
      .index("by_wca_id", ["wcaId"])
      .index("by_archived_name", ["archived", "name"]),
    ...pluginTables,
  },
  {
    schemaValidation: true,
  }
)

export default schema
