# User Actions & Consequences

Complete reference of all actions a user can take in the Headquarters app and their resulting effects.

---

## Table of Contents

- [Authentication](#authentication)
- [Dashboard](#dashboard)
- [Tasks](#tasks)
- [Competitions](#competitions)
- [Comments & Reactions](#comments--reactions)
- [Notifications & Inbox](#notifications--inbox)
- [Reminders](#reminders)
- [Saved Views](#saved-views)
- [User Account](#user-account)
- [Teams (Director Only)](#teams-director-only)
- [Labels (Director Only)](#labels-director-only)
- [Phases (Director Only)](#phases-director-only)
- [Linked Actions (Director Only)](#linked-actions-director-only)
- [Sponsorship Management (Director Only)](#sponsorship-management-director-only)
- [Sponsor Portal](#sponsor-portal)
- [Refunds (Director Only)](#refunds-director-only)
- [Admin Utilities (Director Only)](#admin-utilities-director-only)

---

## Authentication

### Sign In with Google OAuth
- **Where:** Login page
- **Consequence:** Creates or retrieves user record. Grants volunteer-level access. A default DiceBear avatar is generated if user has no avatar.

### Sign In with WCA OAuth
- **Where:** Login page
- **Consequence:** Authenticates via World Cube Association credentials. Used for external organisers. Same user record creation flow as Google.

### Sign In via Login Ticket
- **Where:** `/auth/login-ticket`
- **Consequence:** Processes a one-time login token (used for admin impersonation or sponsor access emails). Token is consumed on use and cannot be reused.

### Sign Out
- **Where:** User menu in sidebar
- **Consequence:** Ends the current session. No data is deleted.

---

## Dashboard

### View Dashboard (`/`)
- **Where:** Home page
- **Consequence:** Read-only. Displays the attention bar (overdue/approaching items), the user's focus widget (assigned tasks), competition health summary, and recent updates feed.

---

## Tasks

### Create Task
- **Where:** "Create" button (global), task list pages
- **Fields:** Title, description, status, priority, due date, assignee, owner (user or team), phase, labels, resources (Google Sheet or Canva design links), required approvers
- **Parent options:** Standalone, child of another task, or child of a competition
- **Consequence:**
  - A new task record is created with an auto-incremented identifier (e.g. `HQ-42`)
  - If an assignee is set, a `task_assigned` notification is sent to the assignee
  - The assignee and owner are auto-subscribed to the task for future notifications
  - `updatedAt` timestamp is set on the task

### Create Tasks from Template
- **Where:** Competition detail page, task creation modal
- **Consequence:** Bulk-creates multiple tasks from a predefined template, all parented to a competition. Each task gets its own auto-incremented identifier.

### Edit Task Title
- **Where:** Task detail page (inline edit)
- **Consequence:** Updates task title. Sets `updatedAt` timestamp.

### Edit Task Description
- **Where:** Task detail page (inline edit, supports markdown)
- **Consequence:** Updates task description. Sets `updatedAt` timestamp.

### Change Task Status
- **Where:** Task detail sidebar, data table dropdown, bulk actions
- **Values:** `backlog`, `to-do`, `in-progress`, `awaiting-review`, `done`, `cancelled`
- **Consequence:**
  - Updates task status and `updatedAt`
  - Sends `task_status_changed` notification to all task subscribers (excluding the actor)
  - If status is changed to `awaiting-review`, also sends `task_awaiting_review` notification
  - Subscribers include: assignee, owner, watchers, and anyone who has explicitly subscribed

### Change Task Priority
- **Where:** Task detail sidebar, data table dropdown, bulk actions
- **Values:** `low`, `medium`, `high`, `urgent`
- **Consequence:**
  - Updates task priority and `updatedAt`
  - Sends `task_priority_changed` notification to all task subscribers

### Change Task Assignee
- **Where:** Task detail sidebar, data table dropdown, bulk actions
- **Consequence:**
  - Updates assignee on the task
  - If a new assignee is set, sends `task_assigned` notification to the new assignee
  - If the previous assignee is removed, sends `task_unassigned` notification to the old assignee
  - The new assignee is auto-subscribed to the task

### Change Task Owner
- **Where:** Task detail sidebar, data table dropdown, bulk actions
- **Consequence:** Updates the owner (user or team). Sets `updatedAt`. If a team is set as owner, all team members may receive notifications for the task.

### Change Task Due Date
- **Where:** Task detail sidebar (calendar picker), bulk actions
- **Consequence:**
  - Updates the due date and `updatedAt`
  - Sends `due_date_changed` notification to all task subscribers
  - Due date is tracked by a scheduled cron job that sends `due_date_approaching` notifications (when due date is near) and `due_date_overdue` notifications (when past due)

### Change Task Phase
- **Where:** Task detail sidebar
- **Consequence:** Updates the phase assignment. Sets `updatedAt`.

### Change Task Labels
- **Where:** Task detail sidebar (multi-select), bulk actions
- **Consequence:** Adds or removes label associations. Sets `updatedAt`.

### Add Task Resources
- **Where:** Task detail sidebar
- **Types:** Google Sheet (by sheet ID), Canva Design (by design ID)
- **Consequence:** Links external resources to the task for quick access. Stored as structured resource entries.

### Add Blocking Relationship
- **Where:** Task detail page, blocking tasks section
- **Consequence:**
  - Creates a `taskRelation` record linking the blocking task to the blocked task
  - Sends `relation_blocked` notification to subscribers of the blocked task
  - Prevents accidental circular dependencies (validated on creation)

### Remove Blocking Relationship
- **Where:** Task detail page, blocking tasks section
- **Consequence:**
  - Deletes the `taskRelation` record
  - Sends `relation_unblocked` notification to subscribers of the previously-blocked task

### Create Subtask
- **Where:** Task detail page, subtasks section
- **Consequence:** Creates a new task with `parentTaskId` set to the current task. The subtask inherits no properties from the parent but is visually grouped under it.

### Add Required Approver
- **Where:** Task detail sidebar, approvals section
- **Consequence:** Adds a user or team to the task's `requiredApprovalIds` list. The task now requires explicit approval from this entity before it can be considered fully approved.

### Remove Required Approver
- **Where:** Task detail sidebar, approvals section
- **Consequence:** Removes the user/team from the required approvers list.

### Approve Task
- **Where:** Task detail sidebar, approvals section
- **Consequence:**
  - Adds the current user to the task's `approvedByIds` list
  - Sends `task_approved` notification to all task subscribers

### Unapprove Task
- **Where:** Task detail sidebar, approvals section
- **Consequence:**
  - Removes the current user from the task's `approvedByIds` list
  - Sends `task_unapproved` notification to all task subscribers

### Archive Task
- **Where:** Task detail page context menu, bulk actions
- **Consequence:**
  - Sets `archived: true` and `archivedAt` timestamp on the task
  - Task disappears from the active task lists and appears in `/tasks/archived`
  - Task data and relationships are preserved (not deleted)

### Unarchive Task
- **Where:** Archived tasks page (`/tasks/archived`)
- **Consequence:** Sets `archived: false`, clears `archivedAt`. Task reappears in active task lists.

### Delete Task
- **Where:** Task detail page context menu, bulk actions
- **Consequence (cascading, irreversible):**
  - The task record is permanently deleted
  - All subtasks are recursively collected and deleted
  - All comments and nested replies on the task are deleted
  - All reminders associated with the task are cancelled and deleted
  - All task relations (blocking/blocked-by) involving the task are deleted
  - All notification subscriptions for the task are deleted
  - All notification artifacts (notifications, events, email stage items) for the task tree are deleted
  - Linked task actions attached to the task are removed

### Bulk Update Tasks
- **Where:** Task data table (select multiple rows, then use bulk actions bar)
- **Available bulk actions:** Update status, priority, assignee, owner, labels, due date
- **Consequence:** Applies the chosen update to all selected tasks simultaneously. Each task triggers its own notifications as if edited individually.

### Bulk Archive Tasks
- **Where:** Bulk actions bar
- **Consequence:** Archives all selected tasks. Same per-task consequences as single archive.

### Bulk Delete Tasks
- **Where:** Bulk actions bar
- **Consequence:** Permanently deletes all selected tasks with full cascade (see Delete Task above). This is irreversible.

### Watch/Subscribe to Task
- **Where:** Task detail page (watch button)
- **Consequence:** Creates a `notificationSubscription` record. The user will receive all future notifications for this task (status changes, comments, priority changes, etc.).

### Unwatch/Unsubscribe from Task
- **Where:** Task detail page (watch button toggle)
- **Consequence:** Deletes the `notificationSubscription` record. The user stops receiving notifications for this task (unless they are the assignee/owner).

---

## Competitions

### Create Competition
- **Where:** "Create" button on competitions page
- **Fields:** Name, description, start date, end date, competition lead, lead delegate, organisers
- **Optional:** Google Sheet link, WCA competition ID link, phase assignment
- **Consequence:**
  - Creates a new competition record
  - Optionally creates `competitionAccess` records for organisers
  - If a template is selected, bulk-creates tasks parented to the competition

### Edit Competition Properties
- **Where:** Competition detail page (`/competitions/$id`), properties sidebar
- **Editable fields:** Name, description, start/end dates, competition lead, lead delegate, organisers, phase, Google Sheet link, WCA competition ID, sponsor property status
- **Consequence:**
  - Updates the competition record and `updatedAt`
  - If the phase changes, sends `competition_phase_changed` notification to all competition subscribers
  - If organisers are added/removed, `competitionAccess` records are updated

### Delete Competition
- **Where:** Competition detail page context menu
- **Consequence:**
  - The competition record is permanently deleted
  - Tasks parented to this competition have their `parentCompetitionId` orphaned (the tasks themselves are NOT deleted)
  - Competition access records are deleted
  - Competition updates are deleted

### Watch/Subscribe to Competition
- **Where:** Competition detail page
- **Consequence:** Creates a notification subscription. The user receives notifications for competition phase changes, progress updates, and comments on updates.

### Unsubscribe from Competition
- **Where:** Competition detail page (toggle)
- **Consequence:** Removes the notification subscription.

### Create Competition Progress Update
- **Where:** Competition detail page, updates section
- **Fields:** Status (`on-track`, `at-risk`, `off-track`), message (markdown)
- **Consequence:**
  - Creates a `competitionUpdates` record
  - Sends `progress_update_added` notification to all competition subscribers

### Edit Competition Progress Update
- **Where:** Competition detail page, existing update
- **Consequence:** Updates the message/status on the update record.

### Delete Competition Progress Update
- **Where:** Competition detail page, existing update
- **Consequence:** Deletes the update record and all comments/replies on that update.

### React to Competition Update
- **Where:** Competition detail page, update reactions
- **Consequence:** Toggles an emoji reaction on the update. Adds or removes the user from the reaction's `userIds` array.

### View Competition Calendar
- **Where:** `/competitions/calendar`
- **Consequence:** Read-only. Displays competitions on a calendar view with weekend override markers.

### View Events Schedule
- **Where:** `/events`
- **Consequence:** Fetches and displays event schedule data from the linked Google Sheet. Data is cached in `sheetScheduleCache`.

---

## Comments & Reactions

### Create Comment
- **Where:** Task detail page or competition update, comments section
- **Fields:** Content (markdown with @mention support)
- **Consequence:**
  - Creates a `comments` record linked to the parent task or update
  - Sends `comment_added` notification to all subscribers of the parent entity
  - If the comment contains @mentions, sends `task_mentioned` notification directly to mentioned users (targeted, not broadcast)
  - The commenter is auto-subscribed to the parent entity

### Reply to Comment
- **Where:** Existing comment, reply button
- **Consequence:**
  - Creates a comment with `parentCommentId` set to the original comment
  - Sends `comment_replied` notification targeted to the original comment's author

### Edit Comment
- **Where:** Own comment, edit button
- **Consequence:** Updates the comment content. Sets `contentUpdatedAt` timestamp to indicate the comment was edited.

### Delete Comment
- **Where:** Own comment, delete button
- **Consequence:**
  - Deletes the comment record
  - Recursively deletes all nested replies
  - Deletes notification subscriptions for the comment
  - Comment reactions are deleted with the comment

### Toggle Emoji Reaction on Comment
- **Where:** Comment reaction bar
- **Consequence:** Adds or removes the current user from the reaction's `userIds` array. If the reaction emoji doesn't exist yet, creates it. If the last user is removed, the reaction entry is cleaned up.

---

## Notifications & Inbox

### View Inbox (`/inbox`)
- **Consequence:** Read-only. Displays all notifications for the current user, sorted by recency.

### Mark Notification as Read
- **Where:** Inbox, notification item
- **Consequence:** Sets `status: "read"` and `readAt` timestamp on the notification.

### Mark All Notifications as Read
- **Where:** Inbox header button
- **Consequence:** Bulk-updates all unread notifications to read status.

### Archive Notification
- **Where:** Inbox, notification item
- **Consequence:** Sets `status: "archived"` and `archivedAt` timestamp. Notification disappears from the default inbox view.

### Snooze Notification
- **Where:** Inbox, notification item
- **Presets:** 1 hour, 3 hours, tomorrow morning, next week
- **Consequence:** Sets `snoozedUntil` timestamp. The notification is hidden from the inbox until the snooze time expires, at which point it reappears as unread.

### Unsnooze Notification
- **Where:** Inbox, snoozed notifications section
- **Consequence:** Clears the `snoozedUntil` field. The notification immediately reappears in the inbox.

### Configure Notification Preferences (`/inbox/settings`)
- **Where:** Inbox settings page
- **Per-notification-type settings:** Enable/disable per channel (in-app, email), digest mode (immediate, hourly, daily, three-daily)
- **Consequence:**
  - Creates or updates `notificationPreferences` records
  - Controls how and when each notification type is delivered
  - Email digest mode determines batching: `immediate` sends one email per event, `daily` batches into a daily digest

### Configure User Notification Settings
- **Where:** Inbox settings page
- **Fields:** Timezone, default digest mode, quiet hours (start/end)
- **Consequence:** Creates or updates `notificationUserSettings`. Quiet hours suppress email delivery during the specified window.

### Unsubscribe from Entity
- **Where:** Inbox settings, notification subscriptions tab
- **Consequence:** Deletes the `notificationSubscription` record for the specified task or competition.

---

## Reminders

### Set Reminder on Task
- **Where:** Task detail page, "Remind me" button
- **Presets:** In 1 hour, in 3 hours, tomorrow morning, next Monday, custom date/time
- **Consequence:**
  - Creates a `reminders` record with `status: "pending"` and `type: "one_time"`
  - Schedules a Convex function to fire at the `remindAt` timestamp
  - When the reminder fires, it creates a `reminder_triggered` notification delivered directly to the user (not broadcast to subscribers)
  - The reminder status changes to `triggered`

### Reschedule Reminder
- **Where:** Reminder notification or reminders list
- **Consequence:** Updates the `remindAt` timestamp and reschedules the underlying Convex function.

---

## Saved Views

### Create Saved View
- **Where:** Task list or competition list, "Save view" button
- **Fields:** Name, description
- **Consequence:**
  - Creates a `savedViews` record storing the current filter configuration and display settings as JSON
  - The view is personal to the user (scoped by `userId`)

### Select Saved View
- **Where:** View dropdown in task/competition lists
- **Consequence:** Applies the saved filters and display settings to the current page. Updates `lastUsedAt` on the view.

### Update Saved View
- **Where:** View dropdown, edit option
- **Consequence:** Overwrites the view's stored filters and display settings with the current configuration.

### Delete Saved View
- **Where:** View dropdown, delete option
- **Consequence:** Permanently deletes the `savedViews` record. The view is no longer available.

---

## User Account

### Update Display Name
- **Where:** `/account` page
- **Consequence:** Updates the user's name in the `users` table. This name is displayed across the app wherever the user is referenced.

### Upload Custom Avatar
- **Where:** `/account` page
- **Accepted formats:** PNG, JPEG, WebP, GIF, AVIF (max 5MB)
- **Consequence:**
  - Generates a Convex storage upload URL
  - Uploads the file to Convex storage
  - Sets the user's `avatarUrl` to the stored file URL

### Generate Random Avatar
- **Where:** `/account` page, "Reroll" button
- **Consequence:** Generates a new random DiceBear avatar SVG and sets it as the user's `avatarUrl`. The previous avatar (if it was a custom upload) is replaced.

---

## Teams (Director Only)

### Create Team
- **Where:** Admin > God Mode > Users tab
- **Fields:** Name, member user IDs
- **Consequence:** Creates a `teams` record. Members can now be assigned as team owners of tasks.

### Update Team
- **Where:** Admin > God Mode > Users tab
- **Fields:** Name, member list
- **Consequence:** Updates the team record. Adding/removing members affects which users receive notifications for team-owned tasks.

### Add Pending Team Member
- **Where:** Admin > God Mode > Users tab
- **Fields:** Email address, team
- **Consequence:** Creates a `pendingTeamMembers` record. When a user with that email signs in for the first time, they are automatically added to the team.

### Remove Pending Team Member
- **Where:** Admin > God Mode > Users tab
- **Consequence:** Deletes the `pendingTeamMembers` record. The email-based auto-join no longer applies.

---

## Labels (Director Only)

### Create Label
- **Where:** Admin > God Mode > Data tab
- **Fields:** Name, color (hex)
- **Consequence:** Creates a `labels` record. The label becomes available for assignment to tasks.

### Update Label
- **Where:** Admin > God Mode > Data tab
- **Consequence:** Updates the label's name or color. All tasks using the label will display the updated name/color.

### Delete Label
- **Where:** Admin > God Mode > Data tab
- **Consequence:** Deletes the `labels` record. Tasks that had this label lose the association (orphaned reference in `labelIds`).

---

## Phases (Director Only)

### Create Phase
- **Where:** Admin > God Mode > Data tab
- **Fields:** Name, description, order number
- **Consequence:** Creates a `phases` record. The phase becomes available for assignment to tasks and competitions.

### Update Phase
- **Where:** Admin > God Mode > Data tab
- **Consequence:** Updates phase name, description, or order.

### Archive Phase
- **Where:** Admin > God Mode > Data tab
- **Consequence:** Sets `archived: true`. The phase is hidden from selection dropdowns but tasks/competitions already assigned to it retain the association.

### Reorder Phases
- **Where:** Admin > God Mode > Data tab
- **Consequence:** Updates the `order` field on phase records, changing the display sequence.

---

## Linked Actions (Director Only)

### Create Linked Action Definition
- **Where:** Admin > God Mode > Linked Integrations tab
- **Types:** `canva_template` (create Canva design from template), `linked_sheet` (Google Sheet operations)
- **Fields:** Name, type, run permission (`anyone`, `volunteer`, `owner`, `assignee`), configuration
- **Canva config:** Source brand template ID, destination folder ID, naming convention
- **Sheet config:** Operation type (`transfer_schedule_to_wca` or `populate_checkin_sheet`)
- **Consequence:** Creates a `linkedActionDefinitions` record. The action becomes available for attachment to tasks.

### Update Linked Action Definition
- **Where:** Admin > God Mode > Linked Integrations tab
- **Consequence:** Updates the definition's configuration. Does not affect already-running instances.

### Archive Linked Action Definition
- **Where:** Admin > God Mode > Linked Integrations tab
- **Consequence:** Sets `archived: true`. The action can no longer be attached to new tasks, but existing attachments remain.

### Attach Action to Task
- **Where:** Task detail page, linked actions section
- **Consequence:** Creates a `taskLinkedActions` record with `status: "idle"`. The action is now available to run from the task.

### Run Linked Action
- **Where:** Task detail page, linked actions section
- **Consequence (Canva template action):**
  - Status changes to `running`
  - Creates a new Canva design from the specified brand template
  - Copies the design to the destination folder
  - Names the design based on the parent task/competition name + suffix
  - On success: links the design as a resource on the task, status changes to `awaiting_manual_share` (user must manually share the design in Canva)
  - On error: status changes to `error` with error message
- **Consequence (linked sheet - transfer schedule to WCA):**
  - Fetches event schedule from the competition's linked Google Sheet
  - Pushes the schedule data to the WCA website via their API
  - Status changes to `awaiting_manual_events_confirmation` (user must confirm on WCA site)
- **Consequence (linked sheet - populate checkin sheet):**
  - Fetches registration data from WCA for the competition
  - Populates a checkin sheet in Google Sheets with the registration data
  - Optionally shares the sheet with configured laptop accounts

### Confirm Manual Share Complete (Canva)
- **Where:** Task detail page, linked action status
- **Consequence:** Changes `taskLinkedAction` status from `awaiting_manual_share` to `completed`.

### Confirm WCA Events Manually
- **Where:** Task detail page, linked action status
- **Consequence:** Changes status from `awaiting_manual_events_confirmation` to `completed`.

### Detach Action from Task
- **Where:** Task detail page, linked actions section
- **Consequence:** Deletes the `taskLinkedActions` record. Any in-progress work (e.g., a Canva design already created) is NOT rolled back.

---

## Sponsorship Management (Director Only)

### Create Sponsor
- **Where:** Admin > Sponsorship page
- **Fields:** Name, email
- **Consequence:** Creates a `sponsors` record with `active: true`. The email is normalized for deduplication.

### Update Sponsor
- **Where:** Admin > Sponsorship page
- **Consequence:** Updates sponsor name, email, or active status.

### Send Sponsor Access Email
- **Where:** Admin > Sponsorship page
- **Consequence:**
  - Generates a one-time login ticket for the sponsor
  - Queues an email via the email dispatch system
  - Sets `lastAccessEmailSentAt` on the sponsor record
  - The sponsor can use the link in the email to sign in to the sponsor portal

### Revoke Sponsor Sessions
- **Where:** Admin > Sponsorship page
- **Consequence:** Invalidates all active sessions for the sponsor. They must re-authenticate.

### Create Auction
- **Where:** Admin > Sponsorship page
- **Fields:** Competition, framework (`first_sealed`, `vickrey`, `ebay_proxy`), currency, start/end dates, start price, anti-sniping window and extension
- **Consequence:**
  - Creates a `sponsorshipAuctions` record in `draft` state
  - Takes a snapshot of competition details for display in the sponsor portal

### Update Auction
- **Where:** Admin > Sponsorship page
- **Consequence:** Updates auction settings. Only allowed while auction is in `draft` or `scheduled` state.

### Start Auction
- **Where:** Admin > Sponsorship page
- **Consequence:**
  - Changes auction state from `draft`/`scheduled` to `active`
  - Auction becomes visible and biddable in the sponsor portal
  - Invited sponsors are notified

### Close Auction
- **Where:** Admin > Sponsorship page
- **Consequence:**
  - Changes auction state to `closed`
  - Determines the winner based on the auction framework:
    - **First sealed:** Highest bidder wins, pays their bid
    - **Vickrey:** Highest bidder wins, pays second-highest bid price
    - **eBay proxy:** Highest max-bid wins, pays one increment above second-highest
  - Sets `winnerSponsorId`, `winningBidId`, `settlementAmountCents`
  - Winner and non-winners are notified via email

### Remove Auction (Before Opening)
- **Where:** Admin > Sponsorship page
- **Consequence:** Permanently deletes the auction record. Only possible in `draft` state.

### Refresh Competition Snapshot
- **Where:** Admin > Sponsorship page
- **Consequence:** Re-fetches competition details and updates the `competitionSnapshot` field on the auction.

---

## Sponsor Portal

### Sponsor Sign In
- **Where:** `/sponsor/login`
- **Consequence:** Authenticates the sponsor using better-auth email authentication (via access email link).

### View Auctions
- **Where:** `/sponsor/auctions`
- **Consequence:** Read-only. Displays all active and closed auctions the sponsor is invited to.

### Place Bid
- **Where:** `/sponsor/auctions/$auctionId`
- **Fields:** Bid amount
- **Consequence:**
  - Creates a `sponsorshipBidIntents` record with `mode: "manual"`
  - Creates a corresponding `sponsorshipBidEvents` record
  - For proxy auctions: updates `currentPriceCents` and `currentLeaderSponsorId` on the auction
  - Anti-sniping: if the bid is placed within the anti-sniping window of the auction end time, the auction end is automatically extended by the configured extension period
  - If another sponsor had a proxy bid, automatic counter-bids are placed up to their max

### Set Maximum Proxy Bid
- **Where:** `/sponsor/auctions/$auctionId` (eBay proxy framework only)
- **Fields:** Maximum amount
- **Consequence:**
  - Creates a `sponsorshipBidIntents` record with `mode: "proxy"` and `maxAmountCents`
  - The system will automatically bid on behalf of the sponsor up to this maximum when outbid
  - Automatic bids generate `sponsorshipBidEvents` with `isAuto: true`

### Update Sponsor Display Name
- **Where:** `/sponsor/settings`
- **Consequence:** Updates the sponsor's display name in the portal.

---

## Refunds (Director Only)

### Create Volunteer Record
- **Where:** Admin > Refunds page
- **Fields:** Name, WCA ID, transfer-to WCA IDs
- **Consequence:** Creates a `refundVolunteers` record. This volunteer is included in refund calculations.

### Update Volunteer Record
- **Where:** Admin > Refunds page
- **Consequence:** Updates volunteer data (name, WCA ID, transfer mappings).

### Delete Volunteer Record
- **Where:** Admin > Refunds page
- **Consequence:** Permanently deletes the `refundVolunteers` record.

### Compute Refunds
- **Where:** Admin > Refunds page
- **Consequence:** Runs a calculation across competition registration data (from WCA) and volunteer records. Outputs a refund breakdown report. No data is modified; this is a read-only computation.

---

## Admin Utilities (Director Only)

### Verify Service Connections
- **Where:** Admin > God Mode > Services tab
- **Services:** Google Sheets, WCA, Canva
- **Consequence:** Checks the validity and expiry of stored OAuth tokens. Read-only diagnostic.

### Connect/Reconnect OAuth Service
- **Where:** Admin > God Mode > Services tab
- **Consequence:**
  - Initiates OAuth flow for the selected service
  - On completion, stores new access and refresh tokens in `serviceTokens`
  - Old tokens are overwritten

### Incognito Login (Impersonation)
- **Where:** Admin > God Mode > Users tab
- **Consequence:**
  - Creates an `adminImpersonationTickets` record with a hashed token
  - The ticket has a short expiry window
  - Generates a login URL that, when visited, authenticates as the target user
  - Used for testing and debugging user-specific issues

### Send Test Digest Email
- **Where:** Admin > God Mode > Email tab
- **Consequence:** Queues a test digest email to the current user via the email dispatch system. Used to verify email delivery is working.

### View Email Dispatch Health
- **Where:** Admin > God Mode > Email tab
- **Consequence:** Read-only. Displays email queue status, delivery rates, and recent dead letters (permanently failed emails).

### Set Weekend Override
- **Where:** Competition calendar
- **Fields:** Saturday date, event note, reserved flag, announced flag
- **Consequence:** Creates or updates a `weekendOverrides` record. Overrides are displayed on the calendar and can be used to mark weekends as reserved for competitions.

### Clear All Weekend Overrides
- **Where:** Competition calendar
- **Consequence:** Deletes all `weekendOverrides` records.

### Generate WCA 2FA Code
- **Where:** Admin > WCA 2FA page
- **Consequence:** Generates a time-based one-time password (TOTP) using the stored WCA 2FA secret. The code is displayed for manual entry on the WCA website. This is read-only and does not modify any data.

### View Social Media Dashboard
- **Where:** Admin > Social Media page
- **Consequence:** Read-only. Fetches competition data from WCA and displays a social media coordination dashboard.

---

## Notification Trigger Summary

The following table summarises which user actions trigger which notification types:

| User Action | Notification Type | Recipients |
|---|---|---|
| Assign task to user | `task_assigned` | Assignee + task subscribers |
| Remove task assignee | `task_unassigned` | Previous assignee + task subscribers |
| @mention in comment | `task_mentioned` | Mentioned user only |
| Change task status | `task_status_changed` | Task subscribers |
| Set status to awaiting-review | `task_awaiting_review` | Task subscribers |
| Change task priority | `task_priority_changed` | Task subscribers |
| Change task due date | `due_date_changed` | Task subscribers |
| (Cron) Due date approaching | `due_date_approaching` | Task subscribers |
| (Cron) Due date passed | `due_date_overdue` | Task subscribers |
| Add comment | `comment_added` | Parent entity subscribers |
| Reply to comment | `comment_replied` | Original comment author |
| Add blocking relation | `relation_blocked` | Blocked task subscribers |
| Remove blocking relation | `relation_unblocked` | Previously blocked task subscribers |
| Approve task | `task_approved` | Task subscribers |
| Unapprove task | `task_unapproved` | Task subscribers |
| Change competition phase | `competition_phase_changed` | Competition subscribers |
| Add progress update | `progress_update_added` | Competition subscribers |
| Reminder fires | `reminder_triggered` | Reminder owner only |

All notifications (except `task_mentioned`, `comment_replied`, and `reminder_triggered`) suppress delivery to the user who performed the action.
