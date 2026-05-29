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
import type * as competitionUpdates_mutations from "../competitionUpdates/mutations.js";
import type * as competitionUpdates_queries from "../competitionUpdates/queries.js";
import type * as competitionUpdates_validators from "../competitionUpdates/validators.js";
import type * as competitionWeekendSlots_mutations from "../competitionWeekendSlots/mutations.js";
import type * as competitionWeekendSlots_validators from "../competitionWeekendSlots/validators.js";
import type * as competitions_board from "../competitions/board.js";
import type * as competitions_calendar from "../competitions/calendar.js";
import type * as competitions_mutations from "../competitions/mutations.js";
import type * as competitions_phaseSnapshot from "../competitions/phaseSnapshot.js";
import type * as competitions_queries from "../competitions/queries.js";
import type * as competitions_validators from "../competitions/validators.js";
import type * as http from "../http.js";
import type * as lib_competitionWeekends from "../lib/competitionWeekends.js";
import type * as lib_localDates from "../lib/localDates.js";
import type * as lib_requireUser from "../lib/requireUser.js";
import type * as phases_defaults from "../phases/defaults.js";
import type * as phases_queries from "../phases/queries.js";
import type * as phases_validators from "../phases/validators.js";
import type * as plugins_canva_oauth from "../plugins/canva/oauth.js";
import type * as plugins_oauth from "../plugins/oauth.js";
import type * as plugins_oauthProvider from "../plugins/oauthProvider.js";
import type * as plugins_tokens from "../plugins/tokens.js";
import type * as plugins_validators from "../plugins/validators.js";
import type * as plugins_wca_oauth from "../plugins/wca/oauth.js";
import type * as reactions from "../reactions.js";
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
import type * as teams_queries from "../teams/queries.js";
import type * as teams_validators from "../teams/validators.js";
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
  "competitionUpdates/mutations": typeof competitionUpdates_mutations;
  "competitionUpdates/queries": typeof competitionUpdates_queries;
  "competitionUpdates/validators": typeof competitionUpdates_validators;
  "competitionWeekendSlots/mutations": typeof competitionWeekendSlots_mutations;
  "competitionWeekendSlots/validators": typeof competitionWeekendSlots_validators;
  "competitions/board": typeof competitions_board;
  "competitions/calendar": typeof competitions_calendar;
  "competitions/mutations": typeof competitions_mutations;
  "competitions/phaseSnapshot": typeof competitions_phaseSnapshot;
  "competitions/queries": typeof competitions_queries;
  "competitions/validators": typeof competitions_validators;
  http: typeof http;
  "lib/competitionWeekends": typeof lib_competitionWeekends;
  "lib/localDates": typeof lib_localDates;
  "lib/requireUser": typeof lib_requireUser;
  "phases/defaults": typeof phases_defaults;
  "phases/queries": typeof phases_queries;
  "phases/validators": typeof phases_validators;
  "plugins/canva/oauth": typeof plugins_canva_oauth;
  "plugins/oauth": typeof plugins_oauth;
  "plugins/oauthProvider": typeof plugins_oauthProvider;
  "plugins/tokens": typeof plugins_tokens;
  "plugins/validators": typeof plugins_validators;
  "plugins/wca/oauth": typeof plugins_wca_oauth;
  reactions: typeof reactions;
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
  "teams/queries": typeof teams_queries;
  "teams/validators": typeof teams_validators;
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
};
