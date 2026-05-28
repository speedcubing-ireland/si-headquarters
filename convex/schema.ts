import { defineSchema, defineTable } from "convex/server"
import { authTables } from "@convex-dev/auth/server"
import { competitionsFields } from "@/convex/competitions/validators"
import { competitionUpdatesFields } from "@/convex/competitionUpdates/validators"
import { subscriptionsFields } from "@/convex/subscriptions/validators"
import { usersFields } from "@/convex/users/validators"
import { phasesFields } from "@/convex/phases/validators"
import { teamsFields } from "@/convex/teams/validators"
import { tasksFields } from "@/convex/tasks/validators"
import {
  taskLabelAssignments,
  taskLabelsFields,
} from "@/convex/tasks/labels/validators"
import {
  taskReviewerFields,
  taskReviewOverrideFields,
} from "@/convex/tasks/reviews/validators"
import { pluginTables } from "@/convex/plugins/validators"

const schema = defineSchema(
  {
    ...authTables,
    users: defineTable(usersFields)
      .index("email", ["email"])
      .index("phone", ["phone"]),
    teams: defineTable(teamsFields),
    competitions: defineTable(competitionsFields),
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
    ...pluginTables,
  },
  {
    schemaValidation: true,
  }
)

export default schema
