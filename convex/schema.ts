import { defineSchema, defineTable } from "convex/server"
import { authTables } from "@convex-dev/auth/server"
import { competitionsCoreFields } from "@/convex/competitions/validators"
import { competitionUpdatesFields } from "@/convex/competitions/updates/validators"
import { competitionWeekendSlotFields } from "@/convex/competitions/weekendSlots/validators"
import { sponsorCompetitionFields } from "@/convex/plugins/sponsor/lib/validators"
import { subscriptionsFields } from "@/convex/subscriptions/validators"
import { usersFields } from "@/convex/users/validators"
import { phasesFields } from "@/convex/phases/validators"
import { teamMembershipFields, teamsFields } from "@/convex/teams/validators"
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

const schema = defineSchema(
  {
    ...authTables,
    users: defineTable(usersFields)
      .index("email", ["email"])
      .index("phone", ["phone"]),
    teams: defineTable(teamsFields).index("by_name", ["name"]),
    teamMemberships: defineTable(teamMembershipFields)
      .index("by_userId", ["userId"])
      .index("by_teamId", ["teamId"])
      .index("by_teamId_and_userId", ["teamId", "userId"]),
    competitions: defineTable({
      ...competitionsCoreFields,
      ...sponsorCompetitionFields,
    }),
    competitionWeekendSlots: defineTable(competitionWeekendSlotFields)
      .index("by_year", ["year"])
      .index("by_year_and_weekendStart", ["year", "weekendStart"]),
    competitionUpdates: defineTable(competitionUpdatesFields),
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
    phases: defineTable(phasesFields).index(
      "by_owner_type_and_owner_id_and_sortKey",
      ["owner.type", "owner.id", "sortKey"]
    ),
    tasks: defineTable(tasksFields)
      .index("by_parent_type_and_parent_id_and_order", [
        "parent.type",
        "parent.id",
        "order",
      ])
      .index("by_owner_type_and_owner_id", ["owner.type", "owner.id"]),
    taskLabels: defineTable(taskLabelsFields),
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
    savedViews: defineTable(savedViewFields)
      .index("by_owner_entity_page", ["ownerId", "entity", "pageId"])
      .index("by_visibility_entity_page", ["visibility", "entity", "pageId"]),
    ...pluginTables,
  },
  {
    schemaValidation: true,
  }
)

export default schema
