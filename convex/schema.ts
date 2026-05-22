import { defineSchema, defineTable } from "convex/server"
import { authTables } from "@convex-dev/auth/server"
import { competitionsFields } from "@/convex/competitions/validators"
import { subscriptionsFields } from "@/convex/subscriptions/validators"
import { usersFields } from "@/convex/users/validators"
import { phasesFields } from "@/convex/phases/validators"

const schema = defineSchema(
  {
    ...authTables,
    users: defineTable(usersFields)
      .index("email", ["email"])
      .index("phone", ["phone"]),
    competitions: defineTable(competitionsFields),
    subscriptions: defineTable(subscriptionsFields).index(
      "by_userId_and_objectType_and_objectId",
      ["userId", "objectType", "objectId"]
    ),
    phases: defineTable(phasesFields).index(
      "by_ownerType_and_ownerId_and_sortKey",
      ["ownerType", "ownerId", "sortKey"]
    ),
  },
  {
    schemaValidation: false,
  }
)

export default schema
