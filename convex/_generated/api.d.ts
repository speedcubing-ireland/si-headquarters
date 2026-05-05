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
import type * as canva from "../canva.js";
import type * as canva_helpers from "../canva/helpers.js";
import type * as comments from "../comments.js";
import type * as competitionAccess from "../competitionAccess.js";
import type * as competitions from "../competitions.js";
import type * as competitionsNodeActions from "../competitionsNodeActions.js";
import type * as crons from "../crons.js";
import type * as emailQueue from "../emailQueue.js";
import type * as emailQueue_diagnostics from "../emailQueue/diagnostics.js";
import type * as emailQueue_enqueue from "../emailQueue/enqueue.js";
import type * as emailQueue_types from "../emailQueue/types.js";
import type * as emailQueue_worker from "../emailQueue/worker.js";
import type * as emails_NotificationDigestEmail from "../emails/NotificationDigestEmail.js";
import type * as emails_NotificationEmail from "../emails/NotificationEmail.js";
import type * as emails_SponsorInviteEmail from "../emails/SponsorInviteEmail.js";
import type * as emails_SponsorshipAuctionActiveReminderEmail from "../emails/SponsorshipAuctionActiveReminderEmail.js";
import type * as emails_SponsorshipEbayAuctionOutbidEmail from "../emails/SponsorshipEbayAuctionOutbidEmail.js";
import type * as emails_SponsorshipInternalInvoiceEmail from "../emails/SponsorshipInternalInvoiceEmail.js";
import type * as emails_SponsorshipOutcomeEmail from "../emails/SponsorshipOutcomeEmail.js";
import type * as emails_SponsorshipScheduledEmail from "../emails/SponsorshipScheduledEmail.js";
import type * as emails_shared from "../emails/shared.js";
import type * as emails_sponsorshipShared from "../emails/sponsorshipShared.js";
import type * as http from "../http.js";
import type * as labels from "../labels.js";
import type * as lib_canvaSharing from "../lib/canvaSharing.js";
import type * as lib_commentParentId from "../lib/commentParentId.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_defaultAvatar from "../lib/defaultAvatar.js";
import type * as lib_deploymentGuard from "../lib/deploymentGuard.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_oauth from "../lib/oauth.js";
import type * as lib_permissions_authn from "../lib/permissions/authn.js";
import type * as lib_permissions_index from "../lib/permissions/index.js";
import type * as lib_permissions_policies from "../lib/permissions/policies.js";
import type * as lib_permissions_require from "../lib/permissions/require.js";
import type * as lib_permissions_resources from "../lib/permissions/resources.js";
import type * as lib_permissions_teams from "../lib/permissions/teams.js";
import type * as lib_refunds from "../lib/refunds.js";
import type * as lib_retry from "../lib/retry.js";
import type * as lib_sanitize from "../lib/sanitize.js";
import type * as lib_seedData from "../lib/seedData.js";
import type * as lib_siteUrls from "../lib/siteUrls.js";
import type * as lib_sponsorshipAccess from "../lib/sponsorshipAccess.js";
import type * as lib_sponsorshipBidPlacement from "../lib/sponsorshipBidPlacement.js";
import type * as lib_sponsorshipBidding from "../lib/sponsorshipBidding.js";
import type * as lib_sponsorshipCompetitionSnapshot from "../lib/sponsorshipCompetitionSnapshot.js";
import type * as lib_sponsorshipEmailTemplates from "../lib/sponsorshipEmailTemplates.js";
import type * as lib_sponsorshipLifecycle from "../lib/sponsorshipLifecycle.js";
import type * as lib_sponsorshipValidators from "../lib/sponsorshipValidators.js";
import type * as lib_sponsorshipVisibility from "../lib/sponsorshipVisibility.js";
import type * as lib_taskDeletion from "../lib/taskDeletion.js";
import type * as lib_taskHydration from "../lib/taskHydration.js";
import type * as lib_taskRelations from "../lib/taskRelations.js";
import type * as lib_taskTransforms from "../lib/taskTransforms.js";
import type * as lib_transforms from "../lib/transforms.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_wca_registrations from "../lib/wca/registrations.js";
import type * as linkedActions from "../linkedActions.js";
import type * as linkedActions_config from "../linkedActions/config.js";
import type * as linkedActions_permissions from "../linkedActions/permissions.js";
import type * as linkedActions_runners from "../linkedActions/runners.js";
import type * as linkedActions_shapes from "../linkedActions/shapes.js";
import type * as notifications from "../notifications.js";
import type * as notifications_catalog from "../notifications/catalog.js";
import type * as notifications_emit from "../notifications/emit.js";
import type * as notifications_index from "../notifications/index.js";
import type * as notifications_lib_cleanup from "../notifications/lib/cleanup.js";
import type * as notifications_lib_dispatchClaims from "../notifications/lib/dispatchClaims.js";
import type * as notifications_lib_emailDispatchComposer from "../notifications/lib/emailDispatchComposer.js";
import type * as notifications_lib_emailPreview from "../notifications/lib/emailPreview.js";
import type * as notifications_lib_emailStageGrouping from "../notifications/lib/emailStageGrouping.js";
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
import type * as notificationsNode from "../notificationsNode.js";
import type * as phases from "../phases.js";
import type * as refunds from "../refunds.js";
import type * as reminders from "../reminders.js";
import type * as seed from "../seed.js";
import type * as services_canva_client from "../services/canva/client.js";
import type * as services_canva_client_client_index from "../services/canva/client/client/index.js";
import type * as services_canva_index from "../services/canva/index.js";
import type * as services_google_index from "../services/google/index.js";
import type * as services_google_sheetsClient from "../services/google/sheetsClient.js";
import type * as services_oauth_flow from "../services/oauth/flow.js";
import type * as services_oauth_index from "../services/oauth/index.js";
import type * as services_oauth_providers from "../services/oauth/providers.js";
import type * as services_services from "../services/services.js";
import type * as services_tokens from "../services/tokens.js";
import type * as services_tokens_runtime from "../services/tokens/runtime.js";
import type * as services_tokens_tokenDefinition from "../services/tokens/tokenDefinition.js";
import type * as services_tokens_types from "../services/tokens/types.js";
import type * as services_types from "../services/types.js";
import type * as services_wca_client from "../services/wca/client.js";
import type * as services_wca_client_client_index from "../services/wca/client/client/index.js";
import type * as services_wca_index from "../services/wca/index.js";
import type * as sheets from "../sheets.js";
import type * as sheetsQueries from "../sheetsQueries.js";
import type * as sponsorAuthServer from "../sponsorAuthServer.js";
import type * as sponsorPortal from "../sponsorPortal.js";
import type * as sponsors from "../sponsors.js";
import type * as sponsorship_auctions_competitionSnapshot from "../sponsorship/auctions/competitionSnapshot.js";
import type * as sponsorship_auctions_emails from "../sponsorship/auctions/emails.js";
import type * as sponsorship_auctions_index from "../sponsorship/auctions/index.js";
import type * as sponsorship_auctions_lifecycle from "../sponsorship/auctions/lifecycle.js";
import type * as sponsorship_auctions_management from "../sponsorship/auctions/management.js";
import type * as sponsorship_auctions_reminders from "../sponsorship/auctions/reminders.js";
import type * as sponsorship_auctions_runtimeCron from "../sponsorship/auctions/runtimeCron.js";
import type * as sponsorship_auctions_shared from "../sponsorship/auctions/shared.js";
import type * as sponsorship_authAccounts from "../sponsorship/authAccounts.js";
import type * as sponsorship_emailQueue from "../sponsorship/emailQueue.js";
import type * as sponsorship_portal_auctions from "../sponsorship/portal/auctions.js";
import type * as sponsorship_portal_auth from "../sponsorship/portal/auth.js";
import type * as sponsorship_portal_index from "../sponsorship/portal/index.js";
import type * as sponsorship_portal_shared from "../sponsorship/portal/shared.js";
import type * as sponsorship_sponsors from "../sponsorship/sponsors.js";
import type * as sponsorshipAuctions from "../sponsorshipAuctions.js";
import type * as sponsorshipNode from "../sponsorshipNode.js";
import type * as taskAccess from "../taskAccess.js";
import type * as taskApprovals from "../taskApprovals.js";
import type * as taskFormat from "../taskFormat.js";
import type * as taskPatch from "../taskPatch.js";
import type * as tasks from "../tasks.js";
import type * as tasks_creation from "../tasks/creation.js";
import type * as tasks_dueDate from "../tasks/dueDate.js";
import type * as teams from "../teams.js";
import type * as test_utils_convexError from "../test_utils/convexError.js";
import type * as updates from "../updates.js";
import type * as userThemeSettings from "../userThemeSettings.js";
import type * as users from "../users.js";
import type * as views from "../views.js";
import type * as wca from "../wca.js";
import type * as wca2fa from "../wca2fa.js";
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
  canva: typeof canva;
  "canva/helpers": typeof canva_helpers;
  comments: typeof comments;
  competitionAccess: typeof competitionAccess;
  competitions: typeof competitions;
  competitionsNodeActions: typeof competitionsNodeActions;
  crons: typeof crons;
  emailQueue: typeof emailQueue;
  "emailQueue/diagnostics": typeof emailQueue_diagnostics;
  "emailQueue/enqueue": typeof emailQueue_enqueue;
  "emailQueue/types": typeof emailQueue_types;
  "emailQueue/worker": typeof emailQueue_worker;
  "emails/NotificationDigestEmail": typeof emails_NotificationDigestEmail;
  "emails/NotificationEmail": typeof emails_NotificationEmail;
  "emails/SponsorInviteEmail": typeof emails_SponsorInviteEmail;
  "emails/SponsorshipAuctionActiveReminderEmail": typeof emails_SponsorshipAuctionActiveReminderEmail;
  "emails/SponsorshipEbayAuctionOutbidEmail": typeof emails_SponsorshipEbayAuctionOutbidEmail;
  "emails/SponsorshipInternalInvoiceEmail": typeof emails_SponsorshipInternalInvoiceEmail;
  "emails/SponsorshipOutcomeEmail": typeof emails_SponsorshipOutcomeEmail;
  "emails/SponsorshipScheduledEmail": typeof emails_SponsorshipScheduledEmail;
  "emails/shared": typeof emails_shared;
  "emails/sponsorshipShared": typeof emails_sponsorshipShared;
  http: typeof http;
  labels: typeof labels;
  "lib/canvaSharing": typeof lib_canvaSharing;
  "lib/commentParentId": typeof lib_commentParentId;
  "lib/constants": typeof lib_constants;
  "lib/defaultAvatar": typeof lib_defaultAvatar;
  "lib/deploymentGuard": typeof lib_deploymentGuard;
  "lib/email": typeof lib_email;
  "lib/oauth": typeof lib_oauth;
  "lib/permissions/authn": typeof lib_permissions_authn;
  "lib/permissions/index": typeof lib_permissions_index;
  "lib/permissions/policies": typeof lib_permissions_policies;
  "lib/permissions/require": typeof lib_permissions_require;
  "lib/permissions/resources": typeof lib_permissions_resources;
  "lib/permissions/teams": typeof lib_permissions_teams;
  "lib/refunds": typeof lib_refunds;
  "lib/retry": typeof lib_retry;
  "lib/sanitize": typeof lib_sanitize;
  "lib/seedData": typeof lib_seedData;
  "lib/siteUrls": typeof lib_siteUrls;
  "lib/sponsorshipAccess": typeof lib_sponsorshipAccess;
  "lib/sponsorshipBidPlacement": typeof lib_sponsorshipBidPlacement;
  "lib/sponsorshipBidding": typeof lib_sponsorshipBidding;
  "lib/sponsorshipCompetitionSnapshot": typeof lib_sponsorshipCompetitionSnapshot;
  "lib/sponsorshipEmailTemplates": typeof lib_sponsorshipEmailTemplates;
  "lib/sponsorshipLifecycle": typeof lib_sponsorshipLifecycle;
  "lib/sponsorshipValidators": typeof lib_sponsorshipValidators;
  "lib/sponsorshipVisibility": typeof lib_sponsorshipVisibility;
  "lib/taskDeletion": typeof lib_taskDeletion;
  "lib/taskHydration": typeof lib_taskHydration;
  "lib/taskRelations": typeof lib_taskRelations;
  "lib/taskTransforms": typeof lib_taskTransforms;
  "lib/transforms": typeof lib_transforms;
  "lib/types": typeof lib_types;
  "lib/validators": typeof lib_validators;
  "lib/wca/registrations": typeof lib_wca_registrations;
  linkedActions: typeof linkedActions;
  "linkedActions/config": typeof linkedActions_config;
  "linkedActions/permissions": typeof linkedActions_permissions;
  "linkedActions/runners": typeof linkedActions_runners;
  "linkedActions/shapes": typeof linkedActions_shapes;
  notifications: typeof notifications;
  "notifications/catalog": typeof notifications_catalog;
  "notifications/emit": typeof notifications_emit;
  "notifications/index": typeof notifications_index;
  "notifications/lib/cleanup": typeof notifications_lib_cleanup;
  "notifications/lib/dispatchClaims": typeof notifications_lib_dispatchClaims;
  "notifications/lib/emailDispatchComposer": typeof notifications_lib_emailDispatchComposer;
  "notifications/lib/emailPreview": typeof notifications_lib_emailPreview;
  "notifications/lib/emailStageGrouping": typeof notifications_lib_emailStageGrouping;
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
  notificationsNode: typeof notificationsNode;
  phases: typeof phases;
  refunds: typeof refunds;
  reminders: typeof reminders;
  seed: typeof seed;
  "services/canva/client": typeof services_canva_client;
  "services/canva/client/client/index": typeof services_canva_client_client_index;
  "services/canva/index": typeof services_canva_index;
  "services/google/index": typeof services_google_index;
  "services/google/sheetsClient": typeof services_google_sheetsClient;
  "services/oauth/flow": typeof services_oauth_flow;
  "services/oauth/index": typeof services_oauth_index;
  "services/oauth/providers": typeof services_oauth_providers;
  "services/services": typeof services_services;
  "services/tokens": typeof services_tokens;
  "services/tokens/runtime": typeof services_tokens_runtime;
  "services/tokens/tokenDefinition": typeof services_tokens_tokenDefinition;
  "services/tokens/types": typeof services_tokens_types;
  "services/types": typeof services_types;
  "services/wca/client": typeof services_wca_client;
  "services/wca/client/client/index": typeof services_wca_client_client_index;
  "services/wca/index": typeof services_wca_index;
  sheets: typeof sheets;
  sheetsQueries: typeof sheetsQueries;
  sponsorAuthServer: typeof sponsorAuthServer;
  sponsorPortal: typeof sponsorPortal;
  sponsors: typeof sponsors;
  "sponsorship/auctions/competitionSnapshot": typeof sponsorship_auctions_competitionSnapshot;
  "sponsorship/auctions/emails": typeof sponsorship_auctions_emails;
  "sponsorship/auctions/index": typeof sponsorship_auctions_index;
  "sponsorship/auctions/lifecycle": typeof sponsorship_auctions_lifecycle;
  "sponsorship/auctions/management": typeof sponsorship_auctions_management;
  "sponsorship/auctions/reminders": typeof sponsorship_auctions_reminders;
  "sponsorship/auctions/runtimeCron": typeof sponsorship_auctions_runtimeCron;
  "sponsorship/auctions/shared": typeof sponsorship_auctions_shared;
  "sponsorship/authAccounts": typeof sponsorship_authAccounts;
  "sponsorship/emailQueue": typeof sponsorship_emailQueue;
  "sponsorship/portal/auctions": typeof sponsorship_portal_auctions;
  "sponsorship/portal/auth": typeof sponsorship_portal_auth;
  "sponsorship/portal/index": typeof sponsorship_portal_index;
  "sponsorship/portal/shared": typeof sponsorship_portal_shared;
  "sponsorship/sponsors": typeof sponsorship_sponsors;
  sponsorshipAuctions: typeof sponsorshipAuctions;
  sponsorshipNode: typeof sponsorshipNode;
  taskAccess: typeof taskAccess;
  taskApprovals: typeof taskApprovals;
  taskFormat: typeof taskFormat;
  taskPatch: typeof taskPatch;
  tasks: typeof tasks;
  "tasks/creation": typeof tasks_creation;
  "tasks/dueDate": typeof tasks_dueDate;
  teams: typeof teams;
  "test_utils/convexError": typeof test_utils_convexError;
  updates: typeof updates;
  userThemeSettings: typeof userThemeSettings;
  users: typeof users;
  views: typeof views;
  wca: typeof wca;
  wca2fa: typeof wca2fa;
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

export declare const components: {
  crons: import("@convex-dev/crons/_generated/component.js").ComponentApi<"crons">;
  sponsorAuth: import("../sponsorAuth/_generated/component.js").ComponentApi<"sponsorAuth">;
};
