import type { Doc, TableNames } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { v } from "convex/values"

type DbReader = Pick<QueryCtx, "db">

export async function collectAll<T extends TableNames>(
  ctx: DbReader,
  table: T
): Promise<Doc<T>[]> {
  return ctx.db.query(table).collect()
}

export function objectRef<const TableName extends string>(
  tableName: TableName
) {
  return v.object({
    type: v.literal(tableName),
    id: v.id(tableName),
  })
}

export function objectRefKey(ref: { type: string; id: string }) {
  return `${ref.type}:${ref.id}`
}
