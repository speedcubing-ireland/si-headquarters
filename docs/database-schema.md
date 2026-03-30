# Convex Database Schema

> Last updated: 2026-03-29 — based on commit [`3cd49d2`](../../commit/3cd49d2b78f0fcd67045a4be1d0fac0380d3f4b4) on `main`

An overview of the database schema organized by domain. There are **30 tables** (plus auth tables) across 8 logical areas.

## Auth & Identity

Split across two systems: **Convex Auth** (main user login via WCA OAuth) and **Better Auth** (sponsor portal login).

| Table | Purpose |
|-------|---------|
| `authTables` (spread) | Built-in Convex Auth tables for user sessions/accounts |
| `teams` | Named groups of users (e.g. "Logistics team") |
| `pendingTeamMembers` | Invited-by-email members not yet in the system |
| `adminImpersonationTickets` | Time-limited tokens letting admins act as a user or sponsor |

Sponsor auth (`convex/sponsorAuth/schema.ts`) has its own `user`, `session`, `account`, `verification`, and `passkey` tables.

## Task Management (core domain)

| Table | Purpose |
|-------|---------|
| `tasks` | Work items with status/priority/assignee/labels/due dates. Can be nested under a parent task or competition |
| `taskCounter` | Auto-incrementing ID generator for task identifiers |
| `taskRelations` | "Task A blocks Task B" dependency edges |
| `labels` | Colored tags applied to tasks |
| `phases` | Ordered workflow stages (tasks & competitions reference a phase) |
| `linkedActionDefinitions` | Reusable automation templates (Canva designs, Google Sheets ops) |
| `taskLinkedActions` | Joins a task to a linked action, tracks run status |
| `savedViews` | Per-user saved filter/display configs for task & competition lists |

**Task statuses:** `backlog` | `to-do` | `in-progress` | `awaiting-review` | `done` | `cancelled`

**Priorities:** `low` | `medium` | `high` | `urgent`

**Linked action types:** `canva_template` | `linked_sheet`

## Competitions

| Table | Purpose |
|-------|---------|
| `competitions` | Speedcubing competitions with dates, leads, organisers, and optional WCA/Google Sheet links |
| `competitionAccess` | Per-user access grants to specific competitions |
| `competitionUpdates` | Status posts (on-track / at-risk / off-track) with reactions |

## Sponsorship & Auctions

| Table | Purpose |
|-------|---------|
| `sponsors` | Sponsor companies/contacts with email and optional portal auth |
| `sponsorshipAuctions` | Auction instances tied to a competition, with pricing, anti-sniping rules, and winner tracking |
| `sponsorshipAuctionInvites` | Which sponsors were invited to which auction |
| `sponsorshipBidIntents` | A sponsor's bid (manual or proxy with max amount) |
| `sponsorshipBidEvents` | Immutable log of every bid placed (including auto-proxy bids) |

**Auction frameworks:** `first_sealed` | `vickrey` | `ebay_proxy`

**Auction states:** `draft` | `scheduled` | `active` | `closed`

**Sponsor property status:** `not_offered` | `bidding` | `none` | `sponsor`

## Notifications

| Table | Purpose |
|-------|---------|
| `notifications` | Delivered notifications per user (unread/read/archived) |
| `notificationEvents` | Source events that trigger notifications (deduplicated by idempotency key) |
| `notificationPreferences` | Per-user, per-type, per-channel toggle + digest mode |
| `notificationUserSettings` | User timezone, quiet hours, default digest mode |
| `notificationSubscriptions` | Explicit "watch this task/competition/comment" subscriptions |
| `notificationEmailStageItems` | Email digest staging pipeline (pending -> composed -> skipped) |

**Notification types:** `task_assigned`, `task_unassigned`, `task_mentioned`, `task_status_changed`, `task_priority_changed`, `task_awaiting_review`, `due_date_approaching`, `due_date_overdue`, `comment_added`, `comment_replied`, `relation_blocked`, `relation_unblocked`, `task_approved`, `task_unapproved`, `due_date_changed`, `reminder_triggered`

**Channels:** `in_app` | `email` | `slack` | `push`

**Digest modes:** `immediate` | `hourly` | `daily` | `three_daily`

## Email Pipeline

| Table | Purpose |
|-------|---------|
| `emailDispatches` | Outbound emails with send status, retry tracking, and provider state |
| `emailDeadLetters` | Failed emails moved here after exhausting retries (replayable) |

**Sources:** `sponsorship` | `notification` | `sponsor_auth`

**Statuses:** `queued` -> `sending` -> `awaiting_provider` -> `sent` (or `dead_letter` / `canceled`)

## Comments & Reminders

| Table | Purpose |
|-------|---------|
| `comments` | Threaded comments on tasks or competition updates, with reactions |
| `reminders` | One-time or recurring reminders tied to tasks, with scheduling state |

## Config & Utilities

| Table | Purpose |
|-------|---------|
| `refundVolunteers` | People who handle refund transfers (by WCA ID) |
| `weekendOverrides` | Mark specific Saturdays as reserved/announced for events |
| `sheetScheduleCache` | Cached Google Sheet competition schedule data |
| `serviceTokens` | OAuth tokens for Google, WCA, and Canva integrations |
| `userThemeSettings` | Per-user UI theme preferences |
| `numbers` | Simple number store (likely for testing/dev) |

## Key Relationships

```
users ──┬── teams (memberIds[])
        ├── tasks (ownerId, assigneeId)
        ├── competitions (compLeadId, leadDelegateId, organiserIds[])
        ├── competitionAccess
        ├── notifications
        ├── reminders
        ├── comments
        └── savedViews

tasks ──┬── tasks (parentTaskId - subtasks)
        ├── competitions (parentCompetitionId)
        ├── taskRelations (blocking/blocked)
        ├── taskLinkedActions -> linkedActionDefinitions
        ├── labels (labelIds[])
        ├── phases (phaseId)
        └── comments

competitions ──┬── sponsorshipAuctions
               ├── competitionAccess
               ├── competitionUpdates
               └── tasks (parentCompetitionId)

sponsors ──┬── sponsorshipAuctions (winner)
           ├── sponsorshipAuctionInvites
           ├── sponsorshipBidIntents
           └── sponsorshipBidEvents

notificationEvents -> notifications -> notificationEmailStageItems -> emailDispatches
                                                                           └── emailDeadLetters
```
