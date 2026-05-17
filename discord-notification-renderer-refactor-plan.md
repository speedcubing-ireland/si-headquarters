# Discord Notification Renderer Refactor Plan

## Summary

Refactor the Discord notification delivery code from one large procedural module into a registry-driven renderer system where every notification type owns its Discord embed and action-button behavior in its own file.

The target outcome is:

- No large `switch (notification.type)` blocks for embed rendering.
- No large `switch (notification.type)` blocks for action buttons.
- Adding/removing/changing a notification means editing one notification-specific file plus the registry.
- Discord delivery/scheduling remains separate from notification presentation.
- No Convex schema migration and no public API contract change.

This plan assumes the current cleanup branch/worktree is the base, including the existing split where `convex/notifications/api.ts` delegates Discord delivery through `convex/notifications/lib/discordDelivery.ts`.

## Target File Structure

Create a new Discord-specific notification package:

```text
convex/notifications/discord/
  actions.ts
  delivery.ts
  message.ts
  registry.ts
  types.ts
  context.ts
  utils.ts

  notifications/
    taskAssigned.ts
    taskUnassigned.ts
    taskMentioned.ts
    taskStatusChanged.ts
    taskPriorityChanged.ts
    taskAwaitingReview.ts
    taskApproved.ts
    taskUnapproved.ts
    dueDateChanged.ts
    dueDateApproaching.ts
    dueDateOverdue.ts
    commentAdded.ts
    commentReplied.ts
    relationBlocked.ts
    relationUnblocked.ts
    competitionPhaseChanged.ts
    progressUpdateAdded.ts
    reminderTriggered.ts
    index.ts
```

Then either delete `convex/notifications/lib/discordDelivery.ts` or reduce it to a compatibility re-export during the refactor. Preferred final state: delete it and update `convex/notifications/api.ts` to import from `convex/notifications/discord/delivery`.

## Internal Interfaces

Add `convex/notifications/discord/types.ts`:

```ts
export type DiscordDestinationKind = "dm" | "channel";

export type DiscordActionButtonSpec = {
  customId: string;
  label: string;
  style: 1 | 2 | 3 | 4 | 5;
  url?: string;
};

export type DiscordEmbedSpec = {
  title: string;
  description?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  author?: { name: string; iconUrl?: string };
};

export type DiscordMessagePayload = DiscordEmbedSpec & {
  message: string;
  url?: string;
  actions: DiscordActionButtonSpec[];
  priority?: "urgent" | "high" | "normal";
};

export type DiscordNotificationDefinition = {
  type: NotificationType;
  viewLabel?: string;
  buildEmbed: (context: DiscordNotificationContext) => Promise<DiscordEmbedSpec>;
  buildActions?: (
    context: DiscordNotificationContext,
  ) => Promise<DiscordActionButtonSpec[]>;
};
```

Add `convex/notifications/discord/context.ts`:

```ts
export type DiscordNotificationContext = {
  ctx: MutationCtx;
  input: NotificationEmitInput;
  payload: NotificationPayload;
  destinationKind: DiscordDestinationKind;
  userId?: Id<"users">;
  entityUrl?: string;
  task: Doc<"tasks"> | null;
  competition: Doc<"competitions"> | null;
  comment: Doc<"comments"> | null;
  progressUpdate: Doc<"competitionUpdates"> | null;
  reminderId?: Id<"reminders">;
  actorName: string;
  actorAuthor?: { name: string; iconUrl?: string };
};
```

`context.ts` will expose one builder:

```ts
export async function buildDiscordNotificationContext(
  ctx: MutationCtx,
  args: {
    input: NotificationEmitInput;
    destinationKind: DiscordDestinationKind;
    userId?: Id<"users">;
  },
): Promise<DiscordNotificationContext>;
```

This function owns all shared entity lookup once: task, competition, comment, progress update, reminder id, entity URL, actor display info, parsed payload.

## Registry

Add `convex/notifications/discord/registry.ts`:

```ts
export const discordNotificationRegistry = {
  task_assigned: taskAssignedDiscordNotification,
  task_unassigned: taskUnassignedDiscordNotification,
  task_mentioned: taskMentionedDiscordNotification,
  task_status_changed: taskStatusChangedDiscordNotification,
  task_priority_changed: taskPriorityChangedDiscordNotification,
  task_awaiting_review: taskAwaitingReviewDiscordNotification,
  due_date_approaching: dueDateApproachingDiscordNotification,
  due_date_overdue: dueDateOverdueDiscordNotification,
  comment_added: commentAddedDiscordNotification,
  comment_replied: commentRepliedDiscordNotification,
  relation_blocked: relationBlockedDiscordNotification,
  relation_unblocked: relationUnblockedDiscordNotification,
  task_approved: taskApprovedDiscordNotification,
  task_unapproved: taskUnapprovedDiscordNotification,
  due_date_changed: dueDateChangedDiscordNotification,
  competition_phase_changed: competitionPhaseChangedDiscordNotification,
  progress_update_added: progressUpdateAddedDiscordNotification,
  reminder_triggered: reminderTriggeredDiscordNotification,
} satisfies Record<NotificationType, DiscordNotificationDefinition>;
```

This gives compile-time coverage for every `NotificationType`.

No runtime fallback should silently hide missing renderers. `message.ts` should read the definition directly from the registry, and TypeScript should enforce completeness.

## Shared Action Helpers

Move token creation and common button builders into `convex/notifications/discord/actions.ts`.

Expose helpers:

```ts
createDiscordActionToken(...)
viewEntityAction(context, labelOverride?)
commentOnTaskAction(context)
replyToCommentAction(context)
startTaskAction(context)
markDoneAction(context)
approveTaskAction(context)
unapproveTaskAction(context)
viewTaskUrlAction(taskId, label)
dismissAction(context)
withDestinationLimits(context, actions)
```

Rules:

- URL/view actions are helper-generated, not hard-coded in every file unless the label is notification-specific.
- DM messages get `Dismiss` appended and are limited to 5 buttons total.
- Channel messages do not get `Dismiss` and are limited to 5 buttons total.
- Action token creation stays in Convex mutation runtime and keeps the current `discordActionTokens` schema unchanged.
- Keep compatibility for existing `open_update_comment_modal` tokens in `convex/discord/api.ts`; do not create new ones from notification renderers.

## Message Pipeline

Add `convex/notifications/discord/message.ts`:

```ts
export async function buildDiscordMessagePayload(
  ctx: MutationCtx,
  args: {
    input: NotificationEmitInput;
    destinationKind: DiscordDestinationKind;
    userId?: Id<"users">;
  },
): Promise<DiscordMessagePayload>;
```

Implementation sequence:

1. Build `DiscordNotificationContext`.
2. Resolve notification definition from `discordNotificationRegistry[input.type]`.
3. Build base view action with `definition.viewLabel`.
4. Call `definition.buildEmbed(context)`.
5. Call `definition.buildActions?.(context)`.
6. Merge actions: view action first, notification-specific actions second.
7. Apply destination limits and append dismiss for DMs.
8. Return `DiscordMessagePayload`.

This replaces `buildTaskDiscordEmbed`, `buildCompetitionDiscordEmbed`, `buildReminderDiscordEmbed`, `buildDiscordEmbedPayload`, and `buildDiscordActionButtons`.

## Delivery Pipeline

Add `convex/notifications/discord/delivery.ts`.

Move only delivery/scheduling concerns here:

```ts
export async function scheduleDiscordDm(...)
export async function scheduleDiscordChannel(...)
```

Keep these responsibilities in `delivery.ts`:

- Discord user link lookup.
- DM preference lookup.
- Channel lookup by entity.
- Channel notification type filtering.
- Scheduling `internal.discord.actions.sendNotificationMessageAction`.

Do not put embed text, action button decisions, or notification-specific logic in `delivery.ts`.

## Per-Notification File Responsibilities

Each file in `convex/notifications/discord/notifications/` exports exactly one `DiscordNotificationDefinition`.

Example shape:

```ts
export const taskAssignedDiscordNotification = {
  type: "task_assigned",
  viewLabel: "View Task",
  buildEmbed: async (context) => ({
    title: context.competition?.name ?? context.input.title,
    description: requireTaskDescription(context),
    fields: [
      {
        name: ":bust_in_silhouette: Task Assigned",
        value:
          context.destinationKind === "dm"
            ? "You were assigned to this task."
            : `${context.actorName} assigned this task.`,
        inline: false,
      },
    ],
    author: context.actorAuthor,
  }),
  buildActions: async (context) => [
    ...(await startTaskAction(context)),
    ...(await commentOnTaskAction(context)),
  ],
} satisfies DiscordNotificationDefinition;
```

Notification-specific assignments:

- `taskAssigned.ts`: assigned embed, start task, comment.
- `taskUnassigned.ts`: unassigned embed, comment.
- `taskMentioned.ts`: mention embed using comment preview, reply.
- `commentAdded.ts`: new comment embed using comment preview, reply.
- `commentReplied.ts`: reply embed using comment preview, reply.
- `taskStatusChanged.ts`: status changed embed, approve when new status is `awaiting-review`, unapprove when new status is `done`, otherwise comment.
- `taskPriorityChanged.ts`: priority changed embed, start task, comment.
- `taskAwaitingReview.ts`: awaiting review embed, approve, comment.
- `taskApproved.ts`: approved embed, unapprove.
- `taskUnapproved.ts`: unapproved embed, approve, comment.
- `dueDateChanged.ts`: due date changed embed, comment.
- `dueDateApproaching.ts`: due soon/today embed, mark done, comment.
- `dueDateOverdue.ts`: overdue embed, mark done, comment.
- `relationBlocked.ts`: blocked embed, view blocker, comment.
- `relationUnblocked.ts`: unblocked embed, start task, view former blocker.
- `competitionPhaseChanged.ts`: phase changed embed, no extra action beyond view.
- `progressUpdateAdded.ts`: progress update embed, no update-comment action.
- `reminderTriggered.ts`: reminder embed, mark done.

## Shared Utilities

Add `convex/notifications/discord/utils.ts` for pure helpers:

```ts
truncateDiscordPreview(value, maxLength?)
labelForStatus(status)
labelForPriority(priority)
progressStatusIcon(status)
taskDescription(context)
requireTask(context)
optionalPayloadString(context, key)
optionalPayloadNumber(context, key)
normalizePayloadId(ctx, table, value)
```

Keep utilities small and non-notification-specific.

## Important Public/API Changes

No public Convex API changes.

Internal changes:

- `convex/notifications/api.ts` imports `scheduleDiscordDm` and `scheduleDiscordChannel` from `./discord/delivery` instead of `./lib/discordDelivery`.
- `convex/_generated/api.d.ts` will change after `bunx convex codegen` because new helper modules are added and the old helper module may be removed.
- No schema changes.
- No changes to `internal.discord.actions.sendNotificationMessageAction` args.
- No changes to `discordActionTokens` table.
- No frontend API changes.

## Compatibility Constraints

- Preserve all current notification type strings in `NOTIFICATION_TYPES`.
- Preserve all current payload fields and idempotency behavior.
- Preserve DM preference behavior.
- Preserve channel notification type override behavior.
- Preserve Discord action token behavior for task status, approve, unapprove, comment, reply, and dismiss.
- Do not reintroduce `progress_update_added` update-comment token creation.
- Keep existing `open_update_comment_modal` token handling in `convex/discord/api.ts` only for compatibility with any existing token documents.

## Implementation Steps

1. Add `convex/notifications/discord/types.ts`, `context.ts`, `utils.ts`, `actions.ts`, `registry.ts`, `message.ts`, and `delivery.ts`.
2. Implement `context.ts` using existing helpers from:
   - `convex/notifications/lib/entities.ts`
   - `convex/notifications/lib/payload.ts`
3. Move `insertDiscordActionToken` into `discord/actions.ts` as `createDiscordActionToken`.
4. Move shared button logic into `discord/actions.ts`.
5. Create one notification definition file per `NotificationType`.
6. Create `convex/notifications/discord/notifications/index.ts` that exports all notification definitions.
7. Implement `registry.ts` with `satisfies Record<NotificationType, DiscordNotificationDefinition>`.
8. Implement `message.ts` to compose context, embed, actions, limits, and final payload.
9. Implement `delivery.ts` by moving only scheduling/preference/channel logic from `lib/discordDelivery.ts`.
10. Update `convex/notifications/api.ts` imports to the new delivery module.
11. Delete `convex/notifications/lib/discordDelivery.ts` once imports are moved.
12. Run `bunx convex codegen`.
13. Format touched files.
14. Run validation.

## Tests

Existing tests to keep passing:

- `bun run test:once convex/notifications`
- `bun run test:once convex/tasks/notifications.behavior.test.ts`
- `bun run test:once convex/updates/crud.behavior.test.ts`
- `bun run test:once convex/reminders/behavior.test.ts`
- `bun run test:once convex/discord/handler.test.ts`
- Full `bun run test:once`

Add focused tests in `convex/notifications/discord/registry.test.ts`:

- Registry contains every `NOTIFICATION_TYPES` value.
- No registry keys exist outside `NOTIFICATION_TYPES`.
- Every definition has `type` matching its registry key.

Add focused message-building tests, preferably in `convex/notifications/discord/message.test.ts` or behavior tests using scheduled function args:

- `task_assigned` DM includes view, start, comment, dismiss.
- `task_status_changed` to `awaiting-review` includes approve and comment.
- `task_status_changed` to `done` includes unapprove.
- `due_date_overdue` includes mark done and comment.
- `comment_replied` includes reply.
- `relation_blocked` includes view blocker.
- `progress_update_added` includes view update and does not create an update-comment token.
- Channel notifications never include dismiss.
- DM notifications cap at 5 actions.
- Channel notifications cap at 5 actions.

Validation commands:

```bash
bun run typecheck
bun run test:once
bun run lint:convex
bunx biome lint <touched files>
bunx knip --no-exit-code --include files,dependencies,unlisted --exclude exports
```

## Acceptance Criteria

- `convex/notifications/lib/discordDelivery.ts` is gone or reduced to a temporary re-export only; preferred final state is gone.
- No function in the new Discord notification package contains a large notification-type switch.
- Each notification type has exactly one file under `convex/notifications/discord/notifications/`.
- The registry is compile-time exhaustive over `NotificationType`.
- Existing tests pass.
- New registry/message tests pass.
- No Convex schema migration is introduced.
- No frontend behavior changes.
- Adding a new notification requires:
  1. Add type to validators/catalog as usual.
  2. Add one Discord notification file.
  3. Add it to the registry.
  4. Add/adjust tests.
