# Notifications Re-Architecture Implementation Progress

## Scope

Track implementation of `/Users/user/Development/SpeedcubingIreland/headquarters/NOTIFICATIONS_REARCHITECTURE.md` with concrete, shippable increments.

## Phase Checklist

- [x] Phase 0: Remove legacy/view-subscription paths and establish clean baseline
- [x] Phase 1: Core contracts (catalog/types/emit) and schema alignment
- [ ] Phase 2: Recipient pipeline modules (expand/filter/schedule)
- [ ] Phase 3: Dispatch engine modularization (enqueue/process/retry/dead-letter)
- [ ] Phase 4: Channel adapters (in-app/email, slack/push stubs)
- [ ] Phase 5: UI integration cleanup and shared event catalog usage
- [ ] Phase 6: Observability, diagnostics, and rollout cleanup

## Progress Log

### 2026-02-12 - Session Start

- Created this progress tracker.
- Started Phase 0 with entity-only subscription migration:
  - remove view-subscription backend API surface
  - remove view-subscription UI/hook usage
  - simplify `notificationSubscriptions` schema/type shape

### 2026-02-12 - Phase 0 Completed

- Backend:
  - Removed runtime support for view subscribers in notification emission pipeline.
  - Removed view subscription APIs from `convex/notifications.ts`:
    - `isSubscribedToView`
    - `subscribeToView`
    - `unsubscribeFromView`
  - Simplified `notificationSubscriptions` schema to entity-only records.
  - Updated subscription response shape to entity-only.
  - Deleted dead notification-view matching modules:
    - `convex/lib/notificationSubscribers.ts`
    - `convex/lib/notificationViewMatchers.ts`
    - `convex/lib/notificationViewMatchers.test.ts`
  - Removed view-linked subscription cleanup from `convex/views.ts`.
- Frontend:
  - Removed view subscription actions/hooks usage from tasks and competitions pages.
  - Updated inbox settings subscription rendering for entity-only shape.
  - Removed exported `useViewSubscriptionState` hook.
- Tests/verification:
  - Updated Convex tests to new entity-only subscription table shape.
  - `npm run typecheck` passes.
  - `npm run test:once -- convex/lib/taskDeletion.test.ts convex/comments.behavior.test.ts convex/notifications.behavior.test.ts` passes.

### 2026-02-12 - Phase 1 In Progress (Initial Slice)

- Added durable dead-letter persistence:
  - New table `notificationDeadLetters` with indexes:
    - `by_failed_at`
    - `by_channel_failed_at`
  - Updated `_markDispatchesFailed` to persist dead-letter rows for failed pending dispatches.
- Added `convex/import-meta-glob.d.ts` to keep Convex test module typing valid under strict backend typecheck.

### 2026-02-12 - Phase 1 Completed

- Added core notification contract modules:
  - `convex/notifications/types.ts`
  - `convex/notifications/catalog.ts`
  - `convex/notifications/emit.ts`
  - `convex/notifications/index.ts`
- Wired the monolith to consume the new contract layer:
  - `convex/notifications.ts` now builds emit payloads via `buildNotificationEmitInput`.
  - Event delivery defaults now come from central catalog policy instead of ad-hoc call-site logic.
- Completed schema alignment for dispatch reliability:
  - Added `maxAttempts` to `notificationDispatches`.
  - Added/kept dead-letter persistence table and write path.
- Updated tests for schema changes where dispatches are inserted directly.
- Verification:
  - `npm run typecheck` passes.
  - `npm run test:once -- convex/notifications.behavior.test.ts convex/comments.behavior.test.ts convex/lib/taskDeletion.test.ts` passes.

### Next Up (Phase 2)

- Split recipient logic from `convex/notifications.ts` into dedicated modules:
  - `convex/notifications/recipients/expand.ts`
  - `convex/notifications/recipients/filter.ts`
  - `convex/notifications/recipients/schedule.ts`
- Split dispatch logic from `convex/notifications.ts` into dedicated modules:
  - `convex/notifications/dispatch/enqueue.ts`
  - `convex/notifications/dispatch/process.ts`
  - `convex/notifications/dispatch/retry.ts`
