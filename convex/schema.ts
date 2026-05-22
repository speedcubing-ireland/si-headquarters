import { defineSchema, defineTable } from "convex/server"
import { authTables } from "@convex-dev/auth/server"
import { competitionsFields } from "@/convex/competitions/validators"
import { subscriptionsFields } from "@/convex/subscriptions/validators"
import { usersFields } from "@/convex/users/validators"

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
  },
  {
    schemaValidation: true,
  }
)

export default schema
