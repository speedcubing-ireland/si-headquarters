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
import type * as competitionAccess from "../competitionAccess.js";
import type * as competitions from "../competitions.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as labels from "../labels.js";
import type * as lib_activity from "../lib/activity.js";
import type * as lib_activityTypes from "../lib/activityTypes.js";
import type * as lib_commentParentId from "../lib/commentParentId.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_entityAccess from "../lib/entityAccess.js";
import type * as lib_sanitize from "../lib/sanitize.js";
import type * as lib_transforms from "../lib/transforms.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_validators from "../lib/validators.js";
import type * as notifications from "../notifications.js";
import type * as phases from "../phases.js";
import type * as reminders from "../reminders.js";
import type * as seed from "../seed.js";
import type * as sheets from "../sheets.js";
import type * as sheetsQueries from "../sheetsQueries.js";
import type * as taskAccess from "../taskAccess.js";
import type * as taskApprovals from "../taskApprovals.js";
import type * as taskFormat from "../taskFormat.js";
import type * as taskNotifications from "../taskNotifications.js";
import type * as taskPatch from "../taskPatch.js";
import type * as tasks from "../tasks.js";
import type * as teams from "../teams.js";
import type * as updates from "../updates.js";
import type * as users from "../users.js";
import type * as views from "../views.js";
import type * as weekendOverrides from "../weekendOverrides.js";

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
  competitionAccess: typeof competitionAccess;
  competitions: typeof competitions;
  crons: typeof crons;
  http: typeof http;
  labels: typeof labels;
  "lib/activity": typeof lib_activity;
  "lib/activityTypes": typeof lib_activityTypes;
  "lib/commentParentId": typeof lib_commentParentId;
  "lib/constants": typeof lib_constants;
  "lib/entityAccess": typeof lib_entityAccess;
  "lib/sanitize": typeof lib_sanitize;
  "lib/transforms": typeof lib_transforms;
  "lib/types": typeof lib_types;
  "lib/validators": typeof lib_validators;
  notifications: typeof notifications;
  phases: typeof phases;
  reminders: typeof reminders;
  seed: typeof seed;
  sheets: typeof sheets;
  sheetsQueries: typeof sheetsQueries;
  taskAccess: typeof taskAccess;
  taskApprovals: typeof taskApprovals;
  taskFormat: typeof taskFormat;
  taskNotifications: typeof taskNotifications;
  taskPatch: typeof taskPatch;
  tasks: typeof tasks;
  teams: typeof teams;
  updates: typeof updates;
  users: typeof users;
  views: typeof views;
  weekendOverrides: typeof weekendOverrides;
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
