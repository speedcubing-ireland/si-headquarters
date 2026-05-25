import { v } from "convex/values"

export function objectRef<const TableName extends string>(
  tableName: TableName
) {
  return v.object({
    type: v.literal(tableName),
    id: v.id(tableName),
  })
}
