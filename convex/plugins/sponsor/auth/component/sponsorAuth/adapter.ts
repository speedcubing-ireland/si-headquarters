import { createApi } from "@convex-dev/better-auth"
import type { GenericCtx } from "@convex-dev/better-auth/utils"
import type { DataModel } from "@/convex/_generated/dataModel"
import {
  createSponsorAuthOptions,
  SPONSOR_AUTH_ANALYSIS_CONFIG,
} from "../../server"
import schema from "./schema"

function createSponsorAuthAnalysisOptions(ctx: GenericCtx<DataModel>) {
  return createSponsorAuthOptions(ctx, SPONSOR_AUTH_ANALYSIS_CONFIG)
}

export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, createSponsorAuthAnalysisOptions)
