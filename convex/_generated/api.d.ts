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
import type * as competitions_api from "../competitions/api.js";
import type * as core_auth from "../core/auth.js";
import type * as core_users from "../core/users.js";
import type * as http from "../http.js";
import type * as integrations_canva_actions from "../integrations/canva/actions.js";
import type * as integrations_canva_client_client from "../integrations/canva/client/client.js";
import type * as integrations_canva_client_client_client_index from "../integrations/canva/client/client/client/index.js";
import type * as integrations_canva_index from "../integrations/canva/index.js";
import type * as integrations_canva_lib_helpers from "../integrations/canva/lib/helpers.js";
import type * as integrations_canva_sharing from "../integrations/canva/sharing.js";
import type * as integrations_google_client_sheetsClient from "../integrations/google/client/sheetsClient.js";
import type * as integrations_google_index from "../integrations/google/index.js";
import type * as integrations_google_sheets from "../integrations/google/sheets.js";
import type * as integrations_google_sheetsQueries from "../integrations/google/sheetsQueries.js";
import type * as integrations_oauth_flow from "../integrations/oauth/flow.js";
import type * as integrations_oauth_index from "../integrations/oauth/index.js";
import type * as integrations_oauth_providers from "../integrations/oauth/providers.js";
import type * as integrations_services from "../integrations/services.js";
import type * as integrations_tokens from "../integrations/tokens.js";
import type * as integrations_tokens_runtime from "../integrations/tokens/runtime.js";
import type * as integrations_tokens_tokenDefinition from "../integrations/tokens/tokenDefinition.js";
import type * as integrations_tokens_types from "../integrations/tokens/types.js";
import type * as integrations_types from "../integrations/types.js";
import type * as integrations_wca_actions from "../integrations/wca/actions.js";
import type * as integrations_wca_client_client from "../integrations/wca/client/client.js";
import type * as integrations_wca_client_client_client_index from "../integrations/wca/client/client/client/index.js";
import type * as integrations_wca_index from "../integrations/wca/index.js";
import type * as integrations_wca_lib_registrations from "../integrations/wca/lib/registrations.js";
import type * as integrations_wca_schedule from "../integrations/wca/schedule.js";
import type * as integrations_wca_twoFactor from "../integrations/wca/twoFactor.js";
import type * as lib_deploymentGuard from "../lib/deploymentGuard.js";
import type * as lib_oauth from "../lib/oauth.js";
import type * as lib_resend from "../lib/resend.js";
import type * as lib_retry from "../lib/retry.js";
import type * as lib_sanitize from "../lib/sanitize.js";
import type * as lib_siteUrls from "../lib/siteUrls.js";
import type * as sponsorship_auctions_competitionSnapshot from "../sponsorship/auctions/competitionSnapshot.js";
import type * as sponsorship_auctions_emails from "../sponsorship/auctions/emails.js";
import type * as sponsorship_auctions_index from "../sponsorship/auctions/index.js";
import type * as sponsorship_auctions_lifecycle from "../sponsorship/auctions/lifecycle.js";
import type * as sponsorship_auctions_management from "../sponsorship/auctions/management.js";
import type * as sponsorship_auctions_reminders from "../sponsorship/auctions/reminders.js";
import type * as sponsorship_auctions_shared from "../sponsorship/auctions/shared.js";
import type * as sponsorship_auth_server from "../sponsorship/auth/server.js";
import type * as sponsorship_authAccounts from "../sponsorship/authAccounts.js";
import type * as sponsorship_emailBatch from "../sponsorship/emailBatch.js";
import type * as sponsorship_emails_SponsorInviteEmail from "../sponsorship/emails/SponsorInviteEmail.js";
import type * as sponsorship_emails_SponsorPortalOtpEmail from "../sponsorship/emails/SponsorPortalOtpEmail.js";
import type * as sponsorship_emails_SponsorshipAuctionActiveReminderEmail from "../sponsorship/emails/SponsorshipAuctionActiveReminderEmail.js";
import type * as sponsorship_emails_SponsorshipEbayAuctionOutbidEmail from "../sponsorship/emails/SponsorshipEbayAuctionOutbidEmail.js";
import type * as sponsorship_emails_SponsorshipInternalInvoiceEmail from "../sponsorship/emails/SponsorshipInternalInvoiceEmail.js";
import type * as sponsorship_emails_SponsorshipOutcomeEmail from "../sponsorship/emails/SponsorshipOutcomeEmail.js";
import type * as sponsorship_emails_SponsorshipScheduledEmail from "../sponsorship/emails/SponsorshipScheduledEmail.js";
import type * as sponsorship_emails_shared from "../sponsorship/emails/shared.js";
import type * as sponsorship_lib_access from "../sponsorship/lib/access.js";
import type * as sponsorship_lib_auctionState from "../sponsorship/lib/auctionState.js";
import type * as sponsorship_lib_bidPlacement from "../sponsorship/lib/bidPlacement.js";
import type * as sponsorship_lib_bidding from "../sponsorship/lib/bidding.js";
import type * as sponsorship_lib_competitionSnapshot from "../sponsorship/lib/competitionSnapshot.js";
import type * as sponsorship_lib_emailTemplates from "../sponsorship/lib/emailTemplates.js";
import type * as sponsorship_lib_lifecycle from "../sponsorship/lib/lifecycle.js";
import type * as sponsorship_lib_validators from "../sponsorship/lib/validators.js";
import type * as sponsorship_lib_visibility from "../sponsorship/lib/visibility.js";
import type * as sponsorship_node from "../sponsorship/node.js";
import type * as sponsorship_portal_auctions from "../sponsorship/portal/auctions.js";
import type * as sponsorship_portal_auth from "../sponsorship/portal/auth.js";
import type * as sponsorship_portal_index from "../sponsorship/portal/index.js";
import type * as sponsorship_portal_shared from "../sponsorship/portal/shared.js";
import type * as sponsorship_sponsors from "../sponsorship/sponsors.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "competitions/api": typeof competitions_api;
  "core/auth": typeof core_auth;
  "core/users": typeof core_users;
  http: typeof http;
  "integrations/canva/actions": typeof integrations_canva_actions;
  "integrations/canva/client/client": typeof integrations_canva_client_client;
  "integrations/canva/client/client/client/index": typeof integrations_canva_client_client_client_index;
  "integrations/canva/index": typeof integrations_canva_index;
  "integrations/canva/lib/helpers": typeof integrations_canva_lib_helpers;
  "integrations/canva/sharing": typeof integrations_canva_sharing;
  "integrations/google/client/sheetsClient": typeof integrations_google_client_sheetsClient;
  "integrations/google/index": typeof integrations_google_index;
  "integrations/google/sheets": typeof integrations_google_sheets;
  "integrations/google/sheetsQueries": typeof integrations_google_sheetsQueries;
  "integrations/oauth/flow": typeof integrations_oauth_flow;
  "integrations/oauth/index": typeof integrations_oauth_index;
  "integrations/oauth/providers": typeof integrations_oauth_providers;
  "integrations/services": typeof integrations_services;
  "integrations/tokens": typeof integrations_tokens;
  "integrations/tokens/runtime": typeof integrations_tokens_runtime;
  "integrations/tokens/tokenDefinition": typeof integrations_tokens_tokenDefinition;
  "integrations/tokens/types": typeof integrations_tokens_types;
  "integrations/types": typeof integrations_types;
  "integrations/wca/actions": typeof integrations_wca_actions;
  "integrations/wca/client/client": typeof integrations_wca_client_client;
  "integrations/wca/client/client/client/index": typeof integrations_wca_client_client_client_index;
  "integrations/wca/index": typeof integrations_wca_index;
  "integrations/wca/lib/registrations": typeof integrations_wca_lib_registrations;
  "integrations/wca/schedule": typeof integrations_wca_schedule;
  "integrations/wca/twoFactor": typeof integrations_wca_twoFactor;
  "lib/deploymentGuard": typeof lib_deploymentGuard;
  "lib/oauth": typeof lib_oauth;
  "lib/resend": typeof lib_resend;
  "lib/retry": typeof lib_retry;
  "lib/sanitize": typeof lib_sanitize;
  "lib/siteUrls": typeof lib_siteUrls;
  "sponsorship/auctions/competitionSnapshot": typeof sponsorship_auctions_competitionSnapshot;
  "sponsorship/auctions/emails": typeof sponsorship_auctions_emails;
  "sponsorship/auctions/index": typeof sponsorship_auctions_index;
  "sponsorship/auctions/lifecycle": typeof sponsorship_auctions_lifecycle;
  "sponsorship/auctions/management": typeof sponsorship_auctions_management;
  "sponsorship/auctions/reminders": typeof sponsorship_auctions_reminders;
  "sponsorship/auctions/shared": typeof sponsorship_auctions_shared;
  "sponsorship/auth/server": typeof sponsorship_auth_server;
  "sponsorship/authAccounts": typeof sponsorship_authAccounts;
  "sponsorship/emailBatch": typeof sponsorship_emailBatch;
  "sponsorship/emails/SponsorInviteEmail": typeof sponsorship_emails_SponsorInviteEmail;
  "sponsorship/emails/SponsorPortalOtpEmail": typeof sponsorship_emails_SponsorPortalOtpEmail;
  "sponsorship/emails/SponsorshipAuctionActiveReminderEmail": typeof sponsorship_emails_SponsorshipAuctionActiveReminderEmail;
  "sponsorship/emails/SponsorshipEbayAuctionOutbidEmail": typeof sponsorship_emails_SponsorshipEbayAuctionOutbidEmail;
  "sponsorship/emails/SponsorshipInternalInvoiceEmail": typeof sponsorship_emails_SponsorshipInternalInvoiceEmail;
  "sponsorship/emails/SponsorshipOutcomeEmail": typeof sponsorship_emails_SponsorshipOutcomeEmail;
  "sponsorship/emails/SponsorshipScheduledEmail": typeof sponsorship_emails_SponsorshipScheduledEmail;
  "sponsorship/emails/shared": typeof sponsorship_emails_shared;
  "sponsorship/lib/access": typeof sponsorship_lib_access;
  "sponsorship/lib/auctionState": typeof sponsorship_lib_auctionState;
  "sponsorship/lib/bidPlacement": typeof sponsorship_lib_bidPlacement;
  "sponsorship/lib/bidding": typeof sponsorship_lib_bidding;
  "sponsorship/lib/competitionSnapshot": typeof sponsorship_lib_competitionSnapshot;
  "sponsorship/lib/emailTemplates": typeof sponsorship_lib_emailTemplates;
  "sponsorship/lib/lifecycle": typeof sponsorship_lib_lifecycle;
  "sponsorship/lib/validators": typeof sponsorship_lib_validators;
  "sponsorship/lib/visibility": typeof sponsorship_lib_visibility;
  "sponsorship/node": typeof sponsorship_node;
  "sponsorship/portal/auctions": typeof sponsorship_portal_auctions;
  "sponsorship/portal/auth": typeof sponsorship_portal_auth;
  "sponsorship/portal/index": typeof sponsorship_portal_index;
  "sponsorship/portal/shared": typeof sponsorship_portal_shared;
  "sponsorship/sponsors": typeof sponsorship_sponsors;
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
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  sponsorAuth: import("../sponsorship/auth/component/sponsorAuth/_generated/component.js").ComponentApi<"sponsorAuth">;
};
