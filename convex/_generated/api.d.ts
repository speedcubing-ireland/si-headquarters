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
import type * as competitions_mutations from "../competitions/mutations.js";
import type * as competitions_queries from "../competitions/queries.js";
import type * as competitions_validators from "../competitions/validators.js";
import type * as http from "../http.js";
import type * as phases_defaults from "../phases/defaults.js";
import type * as phases_queries from "../phases/queries.js";
import type * as phases_validators from "../phases/validators.js";
import type * as subscriptions_index from "../subscriptions/index.js";
import type * as subscriptions_validators from "../subscriptions/validators.js";
import type * as users_queries from "../users/queries.js";
import type * as users_validators from "../users/validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "competitions/mutations": typeof competitions_mutations;
  "competitions/queries": typeof competitions_queries;
  "competitions/validators": typeof competitions_validators;
  http: typeof http;
  "phases/defaults": typeof phases_defaults;
  "phases/queries": typeof phases_queries;
  "phases/validators": typeof phases_validators;
  "subscriptions/index": typeof subscriptions_index;
  "subscriptions/validators": typeof subscriptions_validators;
  "users/queries": typeof users_queries;
  "users/validators": typeof users_validators;
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
