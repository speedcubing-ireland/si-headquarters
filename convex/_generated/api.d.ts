/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as comments from "../comments.js";
import type * as competitions from "../competitions.js";
import type * as http from "../http.js";
import type * as labels from "../labels.js";
import type * as notifications from "../notifications.js";
import type * as phases from "../phases.js";
import type * as reminders from "../reminders.js";
import type * as seed from "../seed.js";
import type * as tasks from "../tasks.js";
import type * as teams from "../teams.js";
import type * as users from "../users.js";
import type * as views from "../views.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  admin: typeof admin;
  auth: typeof auth;
  comments: typeof comments;
  competitions: typeof competitions;
  http: typeof http;
  labels: typeof labels;
  notifications: typeof notifications;
  phases: typeof phases;
  reminders: typeof reminders;
  seed: typeof seed;
  tasks: typeof tasks;
  teams: typeof teams;
  users: typeof users;
  views: typeof views;
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
