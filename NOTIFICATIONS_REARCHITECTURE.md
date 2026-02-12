# Notifications Re-Architecture Plan (Implementation Blueprint)

## Status

- Scope: full rewrite of notification architecture and UI integration
- Backward compatibility: not required
- Existing data retention: not required
- Primary goals: reliability, strong UX, clean DX, multi-channel extensibility, minimum duplicated code

## Non-Negotiables

1. Single emission API from domain code.
2. One recipient resolution pipeline shared by all channels.
3. Channel adapters must be pluggable and isolated.
4. All scheduled/queued execution paths use Convex internal functions.
5. No view-based subscriptions in v2 (entity-only subscriptions).
6. Stable idempotency and replay safety.
7. Inbox UX must stay fast and understandable with high notification volume.

## Target Architecture

```
Domain mutations/actions
  -> notifications.emit()
      -> notificationEvents (idempotent insert/get)
      -> recipient resolver
          -> candidate expansion
          -> authorization + preference filtering
          -> per-channel scheduling decision
      -> notificationDispatches (one row per user+channel+window)
      -> schedule internal dispatch processor (runAt)
          -> channel adapter send()
              -> sent | retry | dead-letter
      -> in-app materializer writes notifications table
```

## Convex-Driven Design Decisions

1. Use scheduled functions (`runAt`/`runAfter`) for per-dispatch timing, not cron.
2. Use cron only for maintenance jobs (sweeper/reconciliation), because cron runs are UTC-based and can be skipped if a previous run overlaps.
3. Schedule only internal functions (`internal.*`) from scheduler and `ctx.run*`.
4. Keep side effects in actions behind idempotent mutation guards (actions can fail after side effects, so send attempts must be guarded).
5. Treat delivery as at-least-once and enforce idempotency at dispatch level.

## Module Layout

```
convex/
  notifications/
    index.ts
    catalog.ts
    emit.ts
    types.ts
    recipients/
      expand.ts
      filter.ts
      schedule.ts
    dispatch/
      enqueue.ts
      process.ts
      retry.ts
      dead_letter.ts
    channels/
      base.ts
      registry.ts
      in_app.ts
      email.ts
      slack.ts      # stub initially
      push.ts       # stub initially
    subscriptions/
      entity.ts
    templates/
      in_app.ts
      email.ts
```

Notes:
- Keep all domain-independent notification logic in `convex/notifications/*`.
- Keep domain triggers thin (`tasks.ts`, `comments.ts`, `competitions.ts` call only `emit`).

## Core Contracts

### 1) Event Catalog (single source of truth)

`catalog.ts` defines per-event defaults:

- `eventKey`
- `entityType`
- default priority
- default channels
- default digest mode policy
- template builders (in-app/email)
- optional fallback policy (for future channels)

This removes scattered per-type switches from backend and frontend.

### 2) Emit Contract

```ts
type EmitNotificationInput = {
  eventKey: NotificationEventKey;
  entity: NotificationEntityRef;
  actorId?: Id<"users">;
  recipients?: Id<"users">[];
  includeEntitySubscribers?: boolean;
  idempotencyKey: string;
  payload: Record<string, string | number | boolean | null>;
};
```

Rules:
- `idempotencyKey` is required.
- Domain code never talks to channels directly.
- Emission should be one line at call sites.

### 3) Channel Adapter Contract

```ts
interface NotificationChannelAdapter {
  channel: NotificationChannel;
  isEnabled(): Promise<boolean>;
  buildPayload(input: ChannelBuildInput): Promise<ChannelPayload>;
  send(payload: ChannelPayload): Promise<ChannelSendResult>;
  sendBatch?(payloads: ChannelPayload[]): Promise<ChannelSendResult[]>;
}
```

## Event Catalog Scope (v2)

Initial event keys to carry into the new catalog:

- `task_assigned`
- `task_unassigned`
- `task_mentioned`
- `task_status_changed`
- `task_priority_changed`
- `task_awaiting_review`
- `task_approved`
- `task_unapproved`
- `due_date_changed`
- `due_date_approaching`
- `due_date_overdue`
- `relation_blocked`
- `relation_unblocked`
- `comment_added`
- `comment_replied`
- `competition_phase_changed`
- `progress_update_added`
- `reminder_triggered`

## Data Model (v2)

### `notificationEvents`

Canonical event log and idempotency anchor.

Fields:
- `idempotencyKey` (unique logical key)
- `eventKey`
- `entityType`, `entityId`, `parentEntityId?`
- `actorId?`
- `payloadJson?`
- `createdAt`

Indexes:
- `by_idempotency_key`
- `by_entity`
- `by_created_at`

### `notifications` (in-app inbox records)

User-visible notifications only.

Fields:
- `userId`
- `eventId`
- `eventKey`
- `priority`
- `status` (`unread` | `read` | `archived`)
- `title`, `message`, `body?`
- `entityType`, `entityId`, `parentEntityId?`
- `snoozedUntil?`
- `createdAt`, `readAt?`, `archivedAt?`

Indexes:
- `by_user`
- `by_user_status`
- `by_user_created_at`
- `by_user_event`

### `notificationDispatches`

One dispatch intent per `eventId + userId + channel + digestWindowKey`.

Fields:
- `eventId`
- `userId`
- `channel`
- `digestMode`
- `digestWindowKey?`
- `scheduledFor`
- `status` (`queued` | `processing` | `sent` | `failed` | `dead`)
- `attempts`
- `maxAttempts`
- `lastError?`
- `providerMessageId?`
- `nextRetryAt?`
- `scheduledFunctionId?`
- `updatedAt`, `sentAt?`

Indexes:
- `by_event_user_channel_window`
- `by_status_scheduled_for`
- `by_user_channel_status`
- `by_channel_status`

### `notificationPreferences`

Per user, per event type, per channel.

Fields:
- `userId`
- `eventKey`
- `channel`
- `enabled`
- `digestMode`
- `respectQuietHours`
- `updatedAt`

Indexes:
- `by_user_event_channel`
- `by_user_channel`

### `notificationUserSettings`

Fields:
- `userId`
- `timezone`
- `defaultDigestMode`
- `quietHoursStartMin?`
- `quietHoursEndMin?`
- `updatedAt`

Indexes:
- `by_user`

### `notificationSubscriptions` (entity only)

Fields:
- `userId`
- `entityType` (`task` | `competition` | `comment`)
- `entityId`
- `createdAt`

Indexes:
- `by_user_entity`
- `by_entity`

### `notificationDeadLetters`

Permanent failures after max retries.

Fields:
- `dispatchId`
- `eventId`
- `userId`
- `channel`
- `error`
- `attempts`
- `failedAt`
- `payloadJson?`

Indexes:
- `by_failed_at`
- `by_channel_failed_at`

## Query and Index Guardrails

1. All hot-path notification queries must use `withIndex` with bounded ranges.
2. Avoid unbounded `.collect()` on notification tables in user-facing queries.
3. For inbox reads, prefer `paginate`/`take` patterns over full scans.
4. Add only indexes needed by real query paths; avoid redundant prefix indexes.

## Delivery Semantics

1. Event creation: idempotent by `idempotencyKey`.
2. Dispatch creation: upsert-style dedupe by `event+user+channel+window`.
3. Processing claim: transition `queued -> processing` atomically.
4. Success: `processing -> sent`.
5. Failure:
- transient: backoff, reschedule, increment `attempts`
- terminal: `dead`, write `notificationDeadLetters`

Retry policy:
- exponential backoff with cap
- channel-specific `maxAttempts`
- no infinite retry loops

## Recipient Resolution Pipeline

### Expand

Sources:
- explicit recipients from emit input
- entity subscribers
- mention-derived recipients (where applicable)

### Filter

Checks:
- actor suppression (avoid notifying actor where appropriate)
- access control to entity
- channel preference enabled/disabled
- dedupe recipient ids

### Schedule

Per recipient+channel:
- resolve timezone and quiet hours
- resolve digest mode
- compute `scheduledFor` and optional `digestWindowKey`

## Channel Strategy

### Phase 1 channels

- `in_app`: always on, inbox materialization
- `email`: opt-in, digest capable

### Phase 2 channels (stubs first)

- `slack`
- `push`

Rules:
- adapters are isolated
- one channel failure must not block others
- channel adapter code should not contain recipient resolution logic

## UX Plan

### Inbox

1. Keep tabs: `Unread`, `Snoozed`, `Read`, `Archived`, `Reminders`, `Settings`, `All`.
2. Ensure deterministic ordering: `createdAt DESC`.
3. Keep primary actions local to each item:
- mark read
- archive
- snooze/unsnooze
- open entity
4. Preserve fast empty states and badge counts.
5. Add optimistic UI for item actions where safe.

### Settings

1. Keep global defaults (digest mode, quiet hours, timezone).
2. Keep per-type per-channel override rows.
3. Remove view-subscription UI and language.
4. Keep active entity subscription list with one-click unsubscribe.
5. Show only channels that are actually enabled in backend config.

### UX Guardrails

- No duplicate notifications for same event.
- Quiet-hours behavior must be predictable and explainable.
- Urgent events should bypass digest only if explicitly configured in catalog.

## DX Plan

1. One public emit function for all domains.
2. One event catalog shared by:
- backend templates
- frontend labels/icons (through generated/static typed map)
3. Remove duplicated event-type constants across backend/frontend.
4. Keep Convex wrappers thin; put business logic in plain helper functions.
5. Add a fake channel adapter for tests and local development.
6. Keep file responsibilities strict (no mixed UI + dispatch logic).

## Implementation Phases

### Phase 0: Hard reset and safety net

- Delete legacy view-subscription paths.
- Optional: add feature flag `notificationsV2` if phased release is needed.
- Add baseline behavior tests for current required flows.

### Phase 1: Core contracts and schema

- Implement v2 schema tables/indexes.
- Implement `catalog.ts`, `types.ts`, `emit.ts`.
- Implement idempotent event upsert.

Exit criteria:
- domain code can emit events through one API
- duplicate emits with same key are no-ops

### Phase 2: Recipient and scheduling pipeline

- Implement expand/filter/schedule modules.
- Implement entity-only subscriptions CRUD.
- Wire quiet hours + digest scheduling.

Exit criteria:
- recipient decisions are deterministic and test-covered

### Phase 3: Dispatch engine

- Implement enqueue and processor internal functions.
- Implement retry/backoff and dead-letter writes.
- Add maintenance sweeper cron for stuck `processing` rows.

Exit criteria:
- dispatch lifecycle transitions are fully covered by tests

### Phase 4: Channel adapters

- Implement in-app adapter.
- Implement email adapter.
- Keep slack/push as no-op stubs with compile-time contracts.

Exit criteria:
- channel failures isolated
- in-app and email end-to-end pass

### Phase 5: UI integration cleanup

- Remove view-subscription usage in frontend hooks/components.
- Align settings and labels with catalog.
- Ensure inbox behavior unchanged except intentional simplifications.

Exit criteria:
- no frontend references to view subscriptions
- settings/inbox tests pass

### Phase 6: Observability and rollout

- Add structured logs for event/dispatch/channel lifecycle.
- Add admin diagnostics query for dispatch health.
- Enable `notificationsV2`, delete v1 code.

Exit criteria:
- v1 code removed
- dashboard metrics available

## Testing Strategy

### Unit

- schedule computation (timezone, quiet hours, digest windows)
- recipient filtering and dedupe
- idempotency key behavior
- retry state transitions

### Integration (Convex behavior tests)

- end-to-end emit -> dispatch -> sent
- email digest grouping behavior
- dead-letter on repeated failure
- authorization guard on recipient access

### UI

- inbox tab counts and action behavior
- settings persistence and override behavior
- optimistic mutation rollback on errors

## Observability and Ops

Track at minimum:
- events emitted per minute
- queued/processing/sent/failed/dead counts
- dispatch latency (`createdAt -> sentAt`) by channel
- retry rate and dead-letter rate
- channel provider error rates

Add alert thresholds:
- dead-letter rate spike
- sustained processing backlog
- provider-specific failures above threshold

## Deletions in v2

- View subscriptions and saved-view matching pipeline.
- Channel-specific branching in domain trigger files.
- Legacy notification helper paths replaced by modular v2 pipeline.

## Cutover Plan (No Migration)

1. Replace old schema definitions directly.
2. Delete v1 notification modules and unused UI hooks/components in same PR series.
3. Deploy v2 and begin writing only v2 tables.
4. Ignore old table data; no backfill and no compatibility layer.

## Success Criteria

1. Adding a new channel requires only:
- adapter implementation
- catalog channel enablement
- optional UI toggle
2. Every notification-producing domain path uses `emit` only.
3. No duplicated event constants across backend/frontend.
4. No view-subscription code remains.
5. Retry and dead-letter behavior is deterministic and test-covered.
6. Inbox remains responsive and understandable under high volume.
