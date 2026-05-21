import { defineSchema } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { USERS_TABLE } from "@/convex/users";
import { COMPETITIONS_TABLE } from "@/convex/competitions";

const schema = defineSchema({
  ...authTables,
  users: USERS_TABLE,
  competitions: COMPETITIONS_TABLE
});
 
export default schema;