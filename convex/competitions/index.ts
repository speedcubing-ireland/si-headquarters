import { defineTable } from "convex/server";
import { v } from "convex/values";

export const COMPETITIONS_TABLE = defineTable({
  name: v.string(),
  description: v.nullable(v.string()),
  people: v.object({
    compLead: v.nullable(v.id("users")),
    leadDelegate: v.nullable(v.id("users")),
    organisers: v.array(v.id("users")),
  }),
  compDates: v.object({
    from: v.nullable(v.string()),
    to: v.nullable(v.string()),
  }),
});
