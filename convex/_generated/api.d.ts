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
import type * as comments from "../comments.js";
import type * as competitionAccess from "../competitionAccess.js";
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
import type * as lib_entityAccess from "../lib/entityAccess.js";
import type * as lib_oauth from "../lib/oauth.js";
import type * as lib_oauthTokens from "../lib/oauthTokens.js";
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
import type * as notifications_channels_base from "../notifications/channels/base.js";
import type * as notifications_channels_email from "../notifications/channels/email.js";
import type * as notifications_channels_in_app from "../notifications/channels/in_app.js";
import type * as notifications_channels_push from "../notifications/channels/push.js";
import type * as notifications_channels_registry from "../notifications/channels/registry.js";
import type * as notifications_channels_slack from "../notifications/channels/slack.js";
import type * as notifications_dispatch_diagnostics from "../notifications/dispatch/diagnostics.js";
import type * as notifications_dispatch_enqueue from "../notifications/dispatch/enqueue.js";
import type * as notifications_dispatch_process from "../notifications/dispatch/process.js";
import type * as notifications_dispatch_retry from "../notifications/dispatch/retry.js";
import type * as notifications_emit from "../notifications/emit.js";
import type * as notifications_index from "../notifications/index.js";
import type * as notifications_lib_cleanup from "../notifications/lib/cleanup.js";
import type * as notifications_lib_dispatchClaims from "../notifications/lib/dispatchClaims.js";
import type * as notifications_lib_emailTemplates from "../notifications/lib/emailTemplates.js";
import type * as notifications_lib_notificationAccess from "../notifications/lib/notificationAccess.js";
import type * as notifications_lib_notificationBuilders from "../notifications/lib/notificationBuilders.js";
import type * as notifications_lib_notificationDueDates from "../notifications/lib/notificationDueDates.js";
import type * as notifications_lib_notificationEmail from "../notifications/lib/notificationEmail.js";
import type * as notifications_lib_notificationHelpers from "../notifications/lib/notificationHelpers.js";
import type * as notifications_lib_notificationScheduling from "../notifications/lib/notificationScheduling.js";
import type * as notifications_lib_notificationSettings from "../notifications/lib/notificationSettings.js";
import type * as notifications_lib_notificationTemplates from "../notifications/lib/notificationTemplates.js";
import type * as notifications_lib_notificationTypes from "../notifications/lib/notificationTypes.js";
import type * as notifications_lib_recipientCollection from "../notifications/lib/recipientCollection.js";
import type * as notifications_lib_validators from "../notifications/lib/validators.js";
import type * as notifications_recipients_expand from "../notifications/recipients/expand.js";
import type * as notifications_recipients_filter from "../notifications/recipients/filter.js";
import type * as notifications_recipients_schedule from "../notifications/recipients/schedule.js";
import type * as notifications_triggers_comments from "../notifications/triggers/comments.js";
import type * as notifications_triggers_competitions from "../notifications/triggers/competitions.js";
import type * as notifications_triggers_tasks from "../notifications/triggers/tasks.js";
import type * as notifications_types from "../notifications/types.js";
import type * as phases from "../phases.js";
import type * as reminders from "../reminders.js";
import type * as seed from "../seed.js";
import type * as sheets from "../sheets.js";
import type * as sheetsQueries from "../sheetsQueries.js";
import type * as taskAccess from "../taskAccess.js";
import type * as taskApprovals from "../taskApprovals.js";
import type * as taskFormat from "../taskFormat.js";
import type * as taskPatch from "../taskPatch.js";
import type * as tasks from "../tasks.js";
import type * as tasks_creation from "../tasks/creation.js";
import type * as tasks_dueDate from "../tasks/dueDate.js";
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
  comments: typeof comments;
  competitionAccess: typeof competitionAccess;
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
  "lib/entityAccess": typeof lib_entityAccess;
  "lib/oauth": typeof lib_oauth;
  "lib/oauthTokens": typeof lib_oauthTokens;
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
  "notifications/channels/base": typeof notifications_channels_base;
  "notifications/channels/email": typeof notifications_channels_email;
  "notifications/channels/in_app": typeof notifications_channels_in_app;
  "notifications/channels/push": typeof notifications_channels_push;
  "notifications/channels/registry": typeof notifications_channels_registry;
  "notifications/channels/slack": typeof notifications_channels_slack;
  "notifications/dispatch/diagnostics": typeof notifications_dispatch_diagnostics;
  "notifications/dispatch/enqueue": typeof notifications_dispatch_enqueue;
  "notifications/dispatch/process": typeof notifications_dispatch_process;
  "notifications/dispatch/retry": typeof notifications_dispatch_retry;
  "notifications/emit": typeof notifications_emit;
  "notifications/index": typeof notifications_index;
  "notifications/lib/cleanup": typeof notifications_lib_cleanup;
  "notifications/lib/dispatchClaims": typeof notifications_lib_dispatchClaims;
  "notifications/lib/emailTemplates": typeof notifications_lib_emailTemplates;
  "notifications/lib/notificationAccess": typeof notifications_lib_notificationAccess;
  "notifications/lib/notificationBuilders": typeof notifications_lib_notificationBuilders;
  "notifications/lib/notificationDueDates": typeof notifications_lib_notificationDueDates;
  "notifications/lib/notificationEmail": typeof notifications_lib_notificationEmail;
  "notifications/lib/notificationHelpers": typeof notifications_lib_notificationHelpers;
  "notifications/lib/notificationScheduling": typeof notifications_lib_notificationScheduling;
  "notifications/lib/notificationSettings": typeof notifications_lib_notificationSettings;
  "notifications/lib/notificationTemplates": typeof notifications_lib_notificationTemplates;
  "notifications/lib/notificationTypes": typeof notifications_lib_notificationTypes;
  "notifications/lib/recipientCollection": typeof notifications_lib_recipientCollection;
  "notifications/lib/validators": typeof notifications_lib_validators;
  "notifications/recipients/expand": typeof notifications_recipients_expand;
  "notifications/recipients/filter": typeof notifications_recipients_filter;
  "notifications/recipients/schedule": typeof notifications_recipients_schedule;
  "notifications/triggers/comments": typeof notifications_triggers_comments;
  "notifications/triggers/competitions": typeof notifications_triggers_competitions;
  "notifications/triggers/tasks": typeof notifications_triggers_tasks;
  "notifications/types": typeof notifications_types;
  phases: typeof phases;
  reminders: typeof reminders;
  seed: typeof seed;
  sheets: typeof sheets;
  sheetsQueries: typeof sheetsQueries;
  taskAccess: typeof taskAccess;
  taskApprovals: typeof taskApprovals;
  taskFormat: typeof taskFormat;
  taskPatch: typeof taskPatch;
  tasks: typeof tasks;
  "tasks/creation": typeof tasks_creation;
  "tasks/dueDate": typeof tasks_dueDate;
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
