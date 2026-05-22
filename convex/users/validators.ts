import { v, type Infer } from "convex/values"
import type { Doc } from "../_generated/dataModel"

export const usersFields = {
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
  emailVerificationTime: v.optional(v.number()),
  phone: v.optional(v.string()),
  phoneVerificationTime: v.optional(v.number()),
  isAnonymous: v.optional(v.boolean()),
  // other "users" fields...
}

export const publicUserFields = {
  _id: v.id("users"),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
}

export const publicUserValidator = v.object(publicUserFields)

export type PublicUser = Infer<typeof publicUserValidator>

export function toPublicUser(
  user: Pick<Doc<"users">, "_id" | "name" | "image">
): PublicUser {
  return {
    _id: user._id,
    name: user.name,
    image: user.image,
  }
}
