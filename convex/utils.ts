import type { Doc, TableNames } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { v, type Infer, type Validator } from "convex/values"

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

export const competitionOrProjectRef = v.union(
  objectRef("competitions"),
  objectRef("projects")
)

export type CompetitionOrProjectRef = Infer<typeof competitionOrProjectRef>

export const commentTargetRef = v.union(
  objectRef("competitions"),
  objectRef("projects"),
  objectRef("tasks")
)

export type CommentTargetRef = Infer<typeof commentTargetRef>

export function objectRefKey(ref: { type: string; id: string }) {
  return `${ref.type}:${ref.id}`
}

export function normalizeNullableText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed.length === 0 ? null : trimmed
}

export function literalUnion<
  const Values extends readonly [string, ...string[]],
>(values: Values): Validator<Values[number]> {
  if (values.length === 1) {
    const validator: Validator<Values[number]> = v.literal(values[0])
    return validator
  }

  const [first, second, ...rest] = values
  const validator: Validator<Values[number]> = v.union(
    v.literal(first),
    v.literal(second),
    ...rest.map((value) => v.literal(value))
  )
  return validator
}
