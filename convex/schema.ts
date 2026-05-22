import { defineSchema, defineTable } from "convex/server"
import { authTables } from "@convex-dev/auth/server"
import { competitionsFields } from "@/convex/competitions/validators"
import {
  competitionUpdateReactionCountsFields,
  competitionUpdateReactionsFields,
  competitionUpdatesFields,
} from "@/convex/competitionUpdates/validators"
import { subscriptionsFields } from "@/convex/subscriptions/validators"
import { usersFields } from "@/convex/users/validators"
import { phasesFields } from "@/convex/phases/validators"
import { teamsFields } from "@/convex/teams/validators"
import { tasksFields } from "@/convex/tasks/validators"
import { taskLabelAssignments, taskLabelsFields } from "@/convex/taskLabels/validators"

const schema = defineSchema(
  {
    ...authTables,
    users: defineTable(usersFields)
      .index("email", ["email"])
      .index("phone", ["phone"]),
    teams: defineTable(teamsFields),
    competitions: defineTable(competitionsFields),
    competitionUpdates: defineTable(competitionUpdatesFields),
    competitionUpdateReactions: defineTable(
      competitionUpdateReactionsFields
    ).index("by_updateId_and_userId_and_emoji", [
        "updateId",
        "userId",
        "emoji",
      ]),
    competitionUpdateReactionCounts: defineTable(
      competitionUpdateReactionCountsFields
    ).index("by_updateId_and_emoji", ["updateId", "emoji"]),
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
    tasks: defineTable(tasksFields), // To-do add indexes based on the queries
    taskLabels: defineTable(taskLabelsFields),
    taskLabelAssignments: defineTable(taskLabelAssignments)
      .index("by_taskId_and_labelId", ["taskId", "labelId"])
      .index("by_labelId_and_taskId", ["labelId", "taskId"]),
  },
  {
    schemaValidation: false,
  }
)

export default schema
