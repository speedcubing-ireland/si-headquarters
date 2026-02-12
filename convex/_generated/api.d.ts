/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as commentNotifications from "../commentNotifications.js";
import type * as comments from "../comments.js";
import type * as competitionAccess from "../competitionAccess.js";
import type * as competitionNotifications from "../competitionNotifications.js";
import type * as competitions from "../competitions.js";
import type * as crons from "../crons.js";
import type * as emails_NotificationDigestEmail from "../emails/NotificationDigestEmail.js";
import type * as emails_NotificationEmail from "../emails/NotificationEmail.js";
import type * as emails_shared from "../emails/shared.js";
import type * as http from "../http.js";
import type * as labels from "../labels.js";
import type * as lib_commentParentId from "../lib/commentParentId.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_emailTemplates from "../lib/emailTemplates.js";
import type * as lib_entityAccess from "../lib/entityAccess.js";
import type * as lib_notificationAccess from "../lib/notificationAccess.js";
import type * as lib_notificationBuilders from "../lib/notificationBuilders.js";
import type * as lib_notificationDueDates from "../lib/notificationDueDates.js";
import type * as lib_notificationEmail from "../lib/notificationEmail.js";
import type * as lib_notificationHelpers from "../lib/notificationHelpers.js";
import type * as lib_notificationScheduling from "../lib/notificationScheduling.js";
import type * as lib_notificationSettings from "../lib/notificationSettings.js";
import type * as lib_notificationTemplates from "../lib/notificationTemplates.js";
import type * as lib_notificationTypes from "../lib/notificationTypes.js";
import type * as lib_oauth from "../lib/oauth.js";
import type * as lib_oauthTokens from "../lib/oauthTokens.js";
import type * as lib_recipientCollection from "../lib/recipientCollection.js";
import type * as lib_sanitize from "../lib/sanitize.js";
import type * as lib_seedData from "../lib/seedData.js";
import type * as lib_taskDeletion from "../lib/taskDeletion.js";
import type * as lib_taskHydration from "../lib/taskHydration.js";
import type * as lib_taskRelations from "../lib/taskRelations.js";
import type * as lib_taskTransforms from "../lib/taskTransforms.js";
import type * as lib_transforms from "../lib/transforms.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_validators from "../lib/validators.js";
import type * as notifications from "../notifications.js";
import type * as notifications_catalog from "../notifications/catalog.js";
import type * as notifications_emit from "../notifications/emit.js";
import type * as notifications_index from "../notifications/index.js";
import type * as notifications_types from "../notifications/types.js";
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
import type * as wca from "../wca.js";
import type * as wca_client from "../wca/client.js";
import type * as wca_oauth from "../wca/oauth.js";
import type * as wcaQueries from "../wcaQueries.js";
import type * as wcaSchedule from "../wcaSchedule.js";
import type * as weekendOverrides from "../weekendOverrides.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  commentNotifications: typeof commentNotifications;
  comments: typeof comments;
  competitionAccess: typeof competitionAccess;
  competitionNotifications: typeof competitionNotifications;
  competitions: typeof competitions;
  crons: typeof crons;
  "emails/NotificationDigestEmail": typeof emails_NotificationDigestEmail;
  "emails/NotificationEmail": typeof emails_NotificationEmail;
  "emails/shared": typeof emails_shared;
  http: typeof http;
  labels: typeof labels;
  "lib/commentParentId": typeof lib_commentParentId;
  "lib/constants": typeof lib_constants;
  "lib/email": typeof lib_email;
  "lib/emailTemplates": typeof lib_emailTemplates;
  "lib/entityAccess": typeof lib_entityAccess;
  "lib/notificationAccess": typeof lib_notificationAccess;
  "lib/notificationBuilders": typeof lib_notificationBuilders;
  "lib/notificationDueDates": typeof lib_notificationDueDates;
  "lib/notificationEmail": typeof lib_notificationEmail;
  "lib/notificationHelpers": typeof lib_notificationHelpers;
  "lib/notificationScheduling": typeof lib_notificationScheduling;
  "lib/notificationSettings": typeof lib_notificationSettings;
  "lib/notificationTemplates": typeof lib_notificationTemplates;
  "lib/notificationTypes": typeof lib_notificationTypes;
  "lib/oauth": typeof lib_oauth;
  "lib/oauthTokens": typeof lib_oauthTokens;
  "lib/recipientCollection": typeof lib_recipientCollection;
  "lib/sanitize": typeof lib_sanitize;
  "lib/seedData": typeof lib_seedData;
  "lib/taskDeletion": typeof lib_taskDeletion;
  "lib/taskHydration": typeof lib_taskHydration;
  "lib/taskRelations": typeof lib_taskRelations;
  "lib/taskTransforms": typeof lib_taskTransforms;
  "lib/transforms": typeof lib_transforms;
  "lib/types": typeof lib_types;
  "lib/validators": typeof lib_validators;
  notifications: typeof notifications;
  "notifications/catalog": typeof notifications_catalog;
  "notifications/emit": typeof notifications_emit;
  "notifications/index": typeof notifications_index;
  "notifications/types": typeof notifications_types;
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
  wca: typeof wca;
  "wca/client": typeof wca_client;
  "wca/oauth": typeof wca_oauth;
  wcaQueries: typeof wcaQueries;
  wcaSchedule: typeof wcaSchedule;
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
