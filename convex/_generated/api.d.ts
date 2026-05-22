/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as competitions_index from "../competitions/index.js";
import type * as competitions_mutations from "../competitions/mutations.js";
import type * as competitions_queries from "../competitions/queries.js";
import type * as http from "../http.js";
import type * as subscriptions_index from "../subscriptions/index.js";
import type * as users_index from "../users/index.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "competitions/index": typeof competitions_index;
  "competitions/mutations": typeof competitions_mutations;
  "competitions/queries": typeof competitions_queries;
  http: typeof http;
  "subscriptions/index": typeof subscriptions_index;
  "users/index": typeof users_index;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
