import { defineTable } from "convex/server";
import { v } from "convex/values";

export const USERS_TABLE = defineTable({
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
  emailVerificationTime: v.optional(v.number()),
  // other "users" fields...
}).index("email", ["email"]);
