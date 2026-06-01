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
import type * as competitions_calendar from "../competitions/calendar.js";
import type * as competitions_dates from "../competitions/dates.js";
import type * as competitions_mutations from "../competitions/mutations.js";
import type * as competitions_phaseSnapshot from "../competitions/phaseSnapshot.js";
import type * as competitions_queries from "../competitions/queries.js";
import type * as competitions_updates_mutations from "../competitions/updates/mutations.js";
import type * as competitions_updates_queries from "../competitions/updates/queries.js";
import type * as competitions_updates_validators from "../competitions/updates/validators.js";
import type * as competitions_validators from "../competitions/validators.js";
import type * as competitions_weekendSlots_mutations from "../competitions/weekendSlots/mutations.js";
import type * as competitions_weekendSlots_validators from "../competitions/weekendSlots/validators.js";
import type * as competitions_weekends from "../competitions/weekends.js";
import type * as http from "../http.js";
import type * as permissions_principal from "../permissions/principal.js";
import type * as permissions_queries from "../permissions/queries.js";
import type * as permissions_shared from "../permissions/shared.js";
import type * as phases_defaults from "../phases/defaults.js";
import type * as phases_queries from "../phases/queries.js";
import type * as phases_validators from "../phases/validators.js";
import type * as plugins_canva_oauth from "../plugins/canva/oauth.js";
import type * as plugins_oauth from "../plugins/oauth.js";
import type * as plugins_oauthProvider from "../plugins/oauthProvider.js";
import type * as plugins_registry from "../plugins/registry.js";
import type * as plugins_sponsor_admin_auctions_competitionSnapshot from "../plugins/sponsor/admin/auctions/competitionSnapshot.js";
import type * as plugins_sponsor_admin_auctions_emails from "../plugins/sponsor/admin/auctions/emails.js";
import type * as plugins_sponsor_admin_auctions_lifecycle from "../plugins/sponsor/admin/auctions/lifecycle.js";
import type * as plugins_sponsor_admin_auctions_management from "../plugins/sponsor/admin/auctions/management.js";
import type * as plugins_sponsor_admin_auctions_reminders from "../plugins/sponsor/admin/auctions/reminders.js";
import type * as plugins_sponsor_admin_auctions_shared from "../plugins/sponsor/admin/auctions/shared.js";
import type * as plugins_sponsor_admin_propertyStatus from "../plugins/sponsor/admin/propertyStatus.js";
import type * as plugins_sponsor_admin_sponsors from "../plugins/sponsor/admin/sponsors.js";
import type * as plugins_sponsor_auth_accounts from "../plugins/sponsor/auth/accounts.js";
import type * as plugins_sponsor_auth_server from "../plugins/sponsor/auth/server.js";
import type * as plugins_sponsor_emails__build from "../plugins/sponsor/emails/_build.js";
import type * as plugins_sponsor_emails__components_anti_sniping_note from "../plugins/sponsor/emails/_components/anti_sniping_note.js";
import type * as plugins_sponsor_emails__components_info_stack from "../plugins/sponsor/emails/_components/info_stack.js";
import type * as plugins_sponsor_emails__components_internal_invoice_email from "../plugins/sponsor/emails/_components/internal_invoice_email.js";
import type * as plugins_sponsor_emails__components_lifecycle_email from "../plugins/sponsor/emails/_components/lifecycle_email.js";
import type * as plugins_sponsor_emails__components_outcome_email from "../plugins/sponsor/emails/_components/outcome_email.js";
import type * as plugins_sponsor_emails__components_sponsorship_email_body from "../plugins/sponsor/emails/_components/sponsorship_email_body.js";
import type * as plugins_sponsor_emails__design from "../plugins/sponsor/emails/_design.js";
import type * as plugins_sponsor_emails_auction_active_reminder from "../plugins/sponsor/emails/auction_active_reminder.js";
import type * as plugins_sponsor_emails_auction_closed_none from "../plugins/sponsor/emails/auction_closed_none.js";
import type * as plugins_sponsor_emails_auction_closed_outbid from "../plugins/sponsor/emails/auction_closed_outbid.js";
import type * as plugins_sponsor_emails_auction_closed_winner from "../plugins/sponsor/emails/auction_closed_winner.js";
import type * as plugins_sponsor_emails_auction_ebay_outbid from "../plugins/sponsor/emails/auction_ebay_outbid.js";
import type * as plugins_sponsor_emails_auction_scheduled from "../plugins/sponsor/emails/auction_scheduled.js";
import type * as plugins_sponsor_emails_auction_started from "../plugins/sponsor/emails/auction_started.js";
import type * as plugins_sponsor_emails_copy from "../plugins/sponsor/emails/copy.js";
import type * as plugins_sponsor_emails_fixtures from "../plugins/sponsor/emails/fixtures.js";
import type * as plugins_sponsor_emails_index from "../plugins/sponsor/emails/index.js";
import type * as plugins_sponsor_emails_internal_invoice_no_winner from "../plugins/sponsor/emails/internal_invoice_no_winner.js";
import type * as plugins_sponsor_emails_internal_invoice_winner from "../plugins/sponsor/emails/internal_invoice_winner.js";
import type * as plugins_sponsor_emails_invite from "../plugins/sponsor/emails/invite.js";
import type * as plugins_sponsor_emails_otp_sign_in from "../plugins/sponsor/emails/otp_sign_in.js";
import type * as plugins_sponsor_emails_render from "../plugins/sponsor/emails/render.js";
import type * as plugins_sponsor_emails_send from "../plugins/sponsor/emails/send.js";
import type * as plugins_sponsor_emails_sendBatch from "../plugins/sponsor/emails/sendBatch.js";
import type * as plugins_sponsor_emails_sender from "../plugins/sponsor/emails/sender.js";
import type * as plugins_sponsor_emails_types from "../plugins/sponsor/emails/types.js";
import type * as plugins_sponsor_http from "../plugins/sponsor/http.js";
import type * as plugins_sponsor_integrations_wca_fetchDetails from "../plugins/sponsor/integrations/wca/fetchDetails.js";
import type * as plugins_sponsor_lib_auctionState from "../plugins/sponsor/lib/auctionState.js";
import type * as plugins_sponsor_lib_bidPlacement from "../plugins/sponsor/lib/bidPlacement.js";
import type * as plugins_sponsor_lib_bidding from "../plugins/sponsor/lib/bidding.js";
import type * as plugins_sponsor_lib_competitionSnapshot from "../plugins/sponsor/lib/competitionSnapshot.js";
import type * as plugins_sponsor_lib_lifecycle from "../plugins/sponsor/lib/lifecycle.js";
import type * as plugins_sponsor_lib_sponsorBidStatus from "../plugins/sponsor/lib/sponsorBidStatus.js";
import type * as plugins_sponsor_lib_sponsorTypes from "../plugins/sponsor/lib/sponsorTypes.js";
import type * as plugins_sponsor_lib_types from "../plugins/sponsor/lib/types.js";
import type * as plugins_sponsor_lib_validators from "../plugins/sponsor/lib/validators.js";
import type * as plugins_sponsor_lib_visibility from "../plugins/sponsor/lib/visibility.js";
import type * as plugins_sponsor_plugin from "../plugins/sponsor/plugin.js";
import type * as plugins_sponsor_portal_auctions from "../plugins/sponsor/portal/auctions.js";
import type * as plugins_sponsor_portal_auth from "../plugins/sponsor/portal/auth.js";
import type * as plugins_sponsor_portal_shared from "../plugins/sponsor/portal/shared.js";
import type * as plugins_sponsor_sanitize from "../plugins/sponsor/sanitize.js";
import type * as plugins_sponsor_siteUrls from "../plugins/sponsor/siteUrls.js";
import type * as plugins_sponsor_testing_testHelpers from "../plugins/sponsor/testing/testHelpers.js";
import type * as plugins_sponsor_validators from "../plugins/sponsor/validators.js";
import type * as plugins_tokens from "../plugins/tokens.js";
import type * as plugins_validators from "../plugins/validators.js";
import type * as plugins_wca_oauth from "../plugins/wca/oauth.js";
import type * as reactions from "../reactions.js";
import type * as sendEmails from "../sendEmails.js";
import type * as subscriptions_index from "../subscriptions/index.js";
import type * as subscriptions_validators from "../subscriptions/validators.js";
import type * as tasks_blockers_competition from "../tasks/blockers/competition.js";
import type * as tasks_blockers_counts from "../tasks/blockers/counts.js";
import type * as tasks_blockers_loader from "../tasks/blockers/loader.js";
import type * as tasks_blockers_mutations from "../tasks/blockers/mutations.js";
import type * as tasks_blockers_queries from "../tasks/blockers/queries.js";
import type * as tasks_blockers_validators from "../tasks/blockers/validators.js";
import type * as tasks_board from "../tasks/board.js";
import type * as tasks_flowView from "../tasks/flowView.js";
import type * as tasks_inlineRow from "../tasks/inlineRow.js";
import type * as tasks_kind from "../tasks/kind.js";
import type * as tasks_labels_queries from "../tasks/labels/queries.js";
import type * as tasks_labels_validators from "../tasks/labels/validators.js";
import type * as tasks_mutations from "../tasks/mutations.js";
import type * as tasks_queries from "../tasks/queries.js";
import type * as tasks_reviews_mutations from "../tasks/reviews/mutations.js";
import type * as tasks_reviews_preview from "../tasks/reviews/preview.js";
import type * as tasks_reviews_queries from "../tasks/reviews/queries.js";
import type * as tasks_reviews_reviewState from "../tasks/reviews/reviewState.js";
import type * as tasks_reviews_validators from "../tasks/reviews/validators.js";
import type * as tasks_status_recompute from "../tasks/status/recompute.js";
import type * as tasks_status_resolver from "../tasks/status/resolver.js";
import type * as tasks_status_rules from "../tasks/status/rules.js";
import type * as tasks_status_validators from "../tasks/status/validators.js";
import type * as tasks_subtaskView from "../tasks/subtaskView.js";
import type * as tasks_validators from "../tasks/validators.js";
import type * as tasks_view from "../tasks/view.js";
import type * as teams_model from "../teams/model.js";
import type * as teams_mutations from "../teams/mutations.js";
import type * as teams_queries from "../teams/queries.js";
import type * as teams_validators from "../teams/validators.js";
import type * as testHelpers from "../testHelpers.js";
import type * as users_queries from "../users/queries.js";
import type * as users_validators from "../users/validators.js";
import type * as utils from "../utils.js";
import type * as views_mutations from "../views/mutations.js";
import type * as views_queries from "../views/queries.js";
import type * as views_validators from "../views/validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "competitions/calendar": typeof competitions_calendar;
  "competitions/dates": typeof competitions_dates;
  "competitions/mutations": typeof competitions_mutations;
  "competitions/phaseSnapshot": typeof competitions_phaseSnapshot;
  "competitions/queries": typeof competitions_queries;
  "competitions/updates/mutations": typeof competitions_updates_mutations;
  "competitions/updates/queries": typeof competitions_updates_queries;
  "competitions/updates/validators": typeof competitions_updates_validators;
  "competitions/validators": typeof competitions_validators;
  "competitions/weekendSlots/mutations": typeof competitions_weekendSlots_mutations;
  "competitions/weekendSlots/validators": typeof competitions_weekendSlots_validators;
  "competitions/weekends": typeof competitions_weekends;
  http: typeof http;
  "permissions/principal": typeof permissions_principal;
  "permissions/queries": typeof permissions_queries;
  "permissions/shared": typeof permissions_shared;
  "phases/defaults": typeof phases_defaults;
  "phases/queries": typeof phases_queries;
  "phases/validators": typeof phases_validators;
  "plugins/canva/oauth": typeof plugins_canva_oauth;
  "plugins/oauth": typeof plugins_oauth;
  "plugins/oauthProvider": typeof plugins_oauthProvider;
  "plugins/registry": typeof plugins_registry;
  "plugins/sponsor/admin/auctions/competitionSnapshot": typeof plugins_sponsor_admin_auctions_competitionSnapshot;
  "plugins/sponsor/admin/auctions/emails": typeof plugins_sponsor_admin_auctions_emails;
  "plugins/sponsor/admin/auctions/lifecycle": typeof plugins_sponsor_admin_auctions_lifecycle;
  "plugins/sponsor/admin/auctions/management": typeof plugins_sponsor_admin_auctions_management;
  "plugins/sponsor/admin/auctions/reminders": typeof plugins_sponsor_admin_auctions_reminders;
  "plugins/sponsor/admin/auctions/shared": typeof plugins_sponsor_admin_auctions_shared;
  "plugins/sponsor/admin/propertyStatus": typeof plugins_sponsor_admin_propertyStatus;
  "plugins/sponsor/admin/sponsors": typeof plugins_sponsor_admin_sponsors;
  "plugins/sponsor/auth/accounts": typeof plugins_sponsor_auth_accounts;
  "plugins/sponsor/auth/server": typeof plugins_sponsor_auth_server;
  "plugins/sponsor/emails/_build": typeof plugins_sponsor_emails__build;
  "plugins/sponsor/emails/_components/anti_sniping_note": typeof plugins_sponsor_emails__components_anti_sniping_note;
  "plugins/sponsor/emails/_components/info_stack": typeof plugins_sponsor_emails__components_info_stack;
  "plugins/sponsor/emails/_components/internal_invoice_email": typeof plugins_sponsor_emails__components_internal_invoice_email;
  "plugins/sponsor/emails/_components/lifecycle_email": typeof plugins_sponsor_emails__components_lifecycle_email;
  "plugins/sponsor/emails/_components/outcome_email": typeof plugins_sponsor_emails__components_outcome_email;
  "plugins/sponsor/emails/_components/sponsorship_email_body": typeof plugins_sponsor_emails__components_sponsorship_email_body;
  "plugins/sponsor/emails/_design": typeof plugins_sponsor_emails__design;
  "plugins/sponsor/emails/auction_active_reminder": typeof plugins_sponsor_emails_auction_active_reminder;
  "plugins/sponsor/emails/auction_closed_none": typeof plugins_sponsor_emails_auction_closed_none;
  "plugins/sponsor/emails/auction_closed_outbid": typeof plugins_sponsor_emails_auction_closed_outbid;
  "plugins/sponsor/emails/auction_closed_winner": typeof plugins_sponsor_emails_auction_closed_winner;
  "plugins/sponsor/emails/auction_ebay_outbid": typeof plugins_sponsor_emails_auction_ebay_outbid;
  "plugins/sponsor/emails/auction_scheduled": typeof plugins_sponsor_emails_auction_scheduled;
  "plugins/sponsor/emails/auction_started": typeof plugins_sponsor_emails_auction_started;
  "plugins/sponsor/emails/copy": typeof plugins_sponsor_emails_copy;
  "plugins/sponsor/emails/fixtures": typeof plugins_sponsor_emails_fixtures;
  "plugins/sponsor/emails/index": typeof plugins_sponsor_emails_index;
  "plugins/sponsor/emails/internal_invoice_no_winner": typeof plugins_sponsor_emails_internal_invoice_no_winner;
  "plugins/sponsor/emails/internal_invoice_winner": typeof plugins_sponsor_emails_internal_invoice_winner;
  "plugins/sponsor/emails/invite": typeof plugins_sponsor_emails_invite;
  "plugins/sponsor/emails/otp_sign_in": typeof plugins_sponsor_emails_otp_sign_in;
  "plugins/sponsor/emails/render": typeof plugins_sponsor_emails_render;
  "plugins/sponsor/emails/send": typeof plugins_sponsor_emails_send;
  "plugins/sponsor/emails/sendBatch": typeof plugins_sponsor_emails_sendBatch;
  "plugins/sponsor/emails/sender": typeof plugins_sponsor_emails_sender;
  "plugins/sponsor/emails/types": typeof plugins_sponsor_emails_types;
  "plugins/sponsor/http": typeof plugins_sponsor_http;
  "plugins/sponsor/integrations/wca/fetchDetails": typeof plugins_sponsor_integrations_wca_fetchDetails;
  "plugins/sponsor/lib/auctionState": typeof plugins_sponsor_lib_auctionState;
  "plugins/sponsor/lib/bidPlacement": typeof plugins_sponsor_lib_bidPlacement;
  "plugins/sponsor/lib/bidding": typeof plugins_sponsor_lib_bidding;
  "plugins/sponsor/lib/competitionSnapshot": typeof plugins_sponsor_lib_competitionSnapshot;
  "plugins/sponsor/lib/lifecycle": typeof plugins_sponsor_lib_lifecycle;
  "plugins/sponsor/lib/sponsorBidStatus": typeof plugins_sponsor_lib_sponsorBidStatus;
  "plugins/sponsor/lib/sponsorTypes": typeof plugins_sponsor_lib_sponsorTypes;
  "plugins/sponsor/lib/types": typeof plugins_sponsor_lib_types;
  "plugins/sponsor/lib/validators": typeof plugins_sponsor_lib_validators;
  "plugins/sponsor/lib/visibility": typeof plugins_sponsor_lib_visibility;
  "plugins/sponsor/plugin": typeof plugins_sponsor_plugin;
  "plugins/sponsor/portal/auctions": typeof plugins_sponsor_portal_auctions;
  "plugins/sponsor/portal/auth": typeof plugins_sponsor_portal_auth;
  "plugins/sponsor/portal/shared": typeof plugins_sponsor_portal_shared;
  "plugins/sponsor/sanitize": typeof plugins_sponsor_sanitize;
  "plugins/sponsor/siteUrls": typeof plugins_sponsor_siteUrls;
  "plugins/sponsor/testing/testHelpers": typeof plugins_sponsor_testing_testHelpers;
  "plugins/sponsor/validators": typeof plugins_sponsor_validators;
  "plugins/tokens": typeof plugins_tokens;
  "plugins/validators": typeof plugins_validators;
  "plugins/wca/oauth": typeof plugins_wca_oauth;
  reactions: typeof reactions;
  sendEmails: typeof sendEmails;
  "subscriptions/index": typeof subscriptions_index;
  "subscriptions/validators": typeof subscriptions_validators;
  "tasks/blockers/competition": typeof tasks_blockers_competition;
  "tasks/blockers/counts": typeof tasks_blockers_counts;
  "tasks/blockers/loader": typeof tasks_blockers_loader;
  "tasks/blockers/mutations": typeof tasks_blockers_mutations;
  "tasks/blockers/queries": typeof tasks_blockers_queries;
  "tasks/blockers/validators": typeof tasks_blockers_validators;
  "tasks/board": typeof tasks_board;
  "tasks/flowView": typeof tasks_flowView;
  "tasks/inlineRow": typeof tasks_inlineRow;
  "tasks/kind": typeof tasks_kind;
  "tasks/labels/queries": typeof tasks_labels_queries;
  "tasks/labels/validators": typeof tasks_labels_validators;
  "tasks/mutations": typeof tasks_mutations;
  "tasks/queries": typeof tasks_queries;
  "tasks/reviews/mutations": typeof tasks_reviews_mutations;
  "tasks/reviews/preview": typeof tasks_reviews_preview;
  "tasks/reviews/queries": typeof tasks_reviews_queries;
  "tasks/reviews/reviewState": typeof tasks_reviews_reviewState;
  "tasks/reviews/validators": typeof tasks_reviews_validators;
  "tasks/status/recompute": typeof tasks_status_recompute;
  "tasks/status/resolver": typeof tasks_status_resolver;
  "tasks/status/rules": typeof tasks_status_rules;
  "tasks/status/validators": typeof tasks_status_validators;
  "tasks/subtaskView": typeof tasks_subtaskView;
  "tasks/validators": typeof tasks_validators;
  "tasks/view": typeof tasks_view;
  "teams/model": typeof teams_model;
  "teams/mutations": typeof teams_mutations;
  "teams/queries": typeof teams_queries;
  "teams/validators": typeof teams_validators;
  testHelpers: typeof testHelpers;
  "users/queries": typeof users_queries;
  "users/validators": typeof users_validators;
  utils: typeof utils;
  "views/mutations": typeof views_mutations;
  "views/queries": typeof views_queries;
  "views/validators": typeof views_validators;
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
  reactions: import("@convex/reactions/_generated/component.js").ComponentApi<"reactions">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  sponsorAuth: import("@/convex/plugins/sponsor/auth/component/sponsorAuth/_generated/component.js").ComponentApi<"sponsorAuth">;
};
