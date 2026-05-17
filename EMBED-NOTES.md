# Notification embed plan

The notification types below are the planning list. Existing code was only used
to identify which notification names exist.

## Watching model

There are three levels of watching:

- **Channel watcher**: the competition Discord channel behaves like a watcher.
  It has its own enabled/disabled notification types. Channel notifications
  should be useful to a room, so default them to competition/task state changes
  and avoid high-volume personal notifications.
- **Competition watcher**: people explicitly watching the competition, plus the
  competition lead, lead delegate, and organisers. This is the right default for
  competition phase changes, progress updates, and major task state changes.
- **Task watcher**: people explicitly watching the task, plus the assignee and
  owner when the owner is a single user. This is the right default for detailed
  task notifications, comments, approvals, blockers, due dates, and reminders.

Watching a task should imply watching its subtasks. The inverse should not be
true: watching a subtask should not imply watching the parent task or sibling
subtasks. Parent-task watchers should receive subtask notifications with the
subtask title/identifier clearly shown so the notification is not ambiguous.

Configuration should exist for all three watcher levels, not just the Discord
channel. Individual notification settings can stop delivery for a person, but
they should not cause delivery by themselves. For example, if a notification is
disabled in the Competition watcher settings, a user enabling that type in their
personal settings should not make them receive it from the competition watcher.

## Notification types

The notification list to plan around:

- `task_assigned`
- `task_unassigned`
- `task_mentioned`
- `task_status_changed`
- `task_priority_changed`
- `task_awaiting_review`
- `due_date_approaching`
- `due_date_overdue`
- `comment_added`
- `comment_replied`
- `relation_blocked`
- `relation_unblocked`
- `task_approved`
- `task_unapproved`
- `due_date_changed`
- `competition_phase_changed`
- `progress_update_added`
- `reminder_triggered`

Planning note: `task_mentioned`, `comment_replied`, and `reminder_triggered`
should remain personal/targeted by default. Comments and due-date urgency can be
too noisy for a competition channel, so they should be opt-in at most.

## Embed conventions

- `title` should be the competition name when the notification belongs to a
  competition.
- `description` should be the task identifier and title when the notification is
  task-specific.
- The first field name should carry the event type and current state.
- The first field value should say what changed and why it matters.
- `author` should be the actor when there is an actor.
- System notifications such as due-date urgency and reminders should omit
  `author` or use an HQ/system author.
- Personal DMs can use "you". Channel notifications should use names.
- Dismiss is only useful for personal messages. Do not show Dismiss in public
  channel messages.
- Channel messages should have fewer actions than DMs. Prefer link actions and
  low-risk actions in public channels.

Common action labels:

- `View Task`
- `View Competition`
- `View Comment`
- `View Update`
- `Reply`
- `Comment`
- `React`
- `Approve`
- `Request Changes`
- `Start Task`
- `Mark Done`
- `Snooze`
- `Dismiss`

## Notification catalog

### `progress_update_added` - Progress Update Added

Default watchers:

- Channel watcher: on
- Competition watcher: on
- Task watcher: off

```json
{
  "title": "Can't See Tralee 2026",
  "fields": [
    {
      "name": ":green_circle: Update Posted - On Track",
      "value": "The competition is almost ready!",
      "inline": false
    }
  ],
  "author": {
    "icon_url": "https://cdn.discordapp.com/avatars/593915321660735511/8d7a1e962e55995034fde19cfa70a6ec.png",
    "name": "Sean O'Toole"
  }
}
```

Actions:

- View Competition
- View Update
- Comment
- React
- Dismiss (personal messages only)

Notes:

- Status icon should map from update status:
  - `on-track`: `:green_circle:`
  - `at-risk`: `:yellow_circle:`
  - `off-track`: `:red_circle:`
- Keep the update body short in Discord. If the progress update is long, show a
  preview and link to the update.

### `competition_phase_changed` - Competition Phase Changed

Default watchers:

- Channel watcher: on
- Competition watcher: on
- Task watcher: off

```json
{
  "title": "Can't See Tralee 2026",
  "fields": [
    {
      "name": ":twisted_rightwards_arrows: Phase Changed - Ready to Announce",
      "value": "Moved from **Registration Setup** to **Ready to Announce**",
      "inline": false
    }
  ],
  "author": {
    "icon_url": "https://cdn.discordapp.com/avatars/593915321660735511/8d7a1e962e55995034fde19cfa70a6ec.png",
    "name": "Sean O'Toole"
  }
}
```

Actions:

- View Competition
- View Tasks
- Comment
- Dismiss (personal messages only)

Notes:

- This should be sent to the competition channel because phase changes are
  useful shared context.

### `task_assigned` - Task Assigned

Default watchers:

- Channel watcher: off by default, configurable
- Competition watcher: on for major/urgent tasks only, configurable
- Task watcher: on

```json
{
  "title": "Can't See Tralee 2026",
  "description": "**HQ-227: Waiting list emailed and refunded**",
  "fields": [
    {
      "name": ":bust_in_silhouette: Task Assigned",
      "value": "**Ellen Byrne** was assigned to this task.",
      "inline": false
    }
  ],
  "author": {
    "icon_url": "https://cdn.discordapp.com/avatars/593915321660735511/8d7a1e962e55995034fde19cfa70a6ec.png",
    "name": "Sean O'Toole"
  }
}
```

Actions:

- View Task
- Start Task
- View Competition
- Comment
- Dismiss (personal messages only)

Notes:

- In a DM to the assignee, copy can be "You were assigned to this task."
- This can be noisy in a channel if assignments churn, so it should be off by
  default for channels unless the competition chooses otherwise.

### `task_unassigned` - Task Unassigned

Default watchers:

- Channel watcher: off by default, configurable
- Competition watcher: off by default, configurable
- Task watcher: on

```json
{
  "title": "Can't See Tralee 2026",
  "description": "**HQ-227: Waiting list emailed and refunded**",
  "fields": [
    {
      "name": ":busts_in_silhouette: Task Unassigned",
      "value": "**Ellen Byrne** was removed as assignee.",
      "inline": false
    }
  ],
  "author": {
    "icon_url": "https://cdn.discordapp.com/avatars/593915321660735511/8d7a1e962e55995034fde19cfa70a6ec.png",
    "name": "Sean O'Toole"
  }
}
```

Actions:

- View Task
- View Competition
- Comment
- Dismiss (personal messages only)

Notes:

- In a DM to the previous assignee, copy can be "You were unassigned from this
  task."

### `task_mentioned` - Mentioned In Comment

Default watchers:

- Channel watcher: off
- Competition watcher: off
- Task watcher: off
- Direct recipient: mentioned user only

```json
{
  "title": "Can't See Tralee 2026",
  "description": "**HQ-227: Waiting list emailed and refunded**",
  "fields": [
    {
      "name": ":speech_balloon: Mentioned in a Comment",
      "value": "**Sean O'Toole:** Can @Ellen confirm the refund batch has gone out?",
      "inline": false
    }
  ],
  "author": {
    "icon_url": "https://cdn.discordapp.com/avatars/593915321660735511/8d7a1e962e55995034fde19cfa70a6ec.png",
    "name": "Sean O'Toole"
  }
}
```

Actions:

- View Comment
- Reply
- View Task
- Dismiss

Notes:

- This should not be broadcast via competition or channel watcher settings.

### `task_status_changed` - Task Status Changed

Default watchers:

- Channel watcher: on
- Competition watcher: on
- Task watcher: on

```json
{
  "title": "Can't See Tralee 2026",
  "description": "**HQ-227: Waiting list emailed and refunded**",
  "fields": [
    {
      "name": ":arrows_counterclockwise: Status Changed - Awaiting Review",
      "value": "Moved from **In Progress** to **Awaiting Review**.",
      "inline": false
    }
  ],
  "author": {
    "icon_url": "https://cdn.discordapp.com/avatars/593915321660735511/8d7a1e962e55995034fde19cfa70a6ec.png",
    "name": "Sean O'Toole"
  }
}
```

Actions:

- View Task
- Approve (when status is awaiting review and the user can approve)
- Request Changes (when status is awaiting review and the user can review)
- Mark Done (when the user can complete the task)
- View Competition
- Dismiss (personal messages only)

Notes:

- If the status change is to `done`, the embed should make completion clear:
  `:white_check_mark: Status Changed - Done`.
- If the status change is to `cancelled`, use a neutral/cancelled style rather
  than a success style.

### `task_priority_changed` - Task Priority Changed

Default watchers:

- Channel watcher: on for high/urgent, configurable for all
- Competition watcher: on
- Task watcher: on

```json
{
  "title": "Can't See Tralee 2026",
  "description": "**HQ-227: Waiting list emailed and refunded**",
  "fields": [
    {
      "name": ":warning: Priority Changed - Urgent",
      "value": "Changed from **Normal** to **Urgent**.",
      "inline": false
    }
  ],
  "author": {
    "icon_url": "https://cdn.discordapp.com/avatars/593915321660735511/8d7a1e962e55995034fde19cfa70a6ec.png",
    "name": "Sean O'Toole"
  }
}
```

Actions:

- View Task
- Start Task
- Comment
- View Competition
- Dismiss (personal messages only)

Notes:

- Priority changes are useful in channels only when they create urgency. Consider
  channel default: urgent/high only.

### `task_awaiting_review` - Task Awaiting Review

Default watchers:

- Channel watcher: on
- Competition watcher: on
- Task watcher: on
- Direct recipients: required approvers/reviewer teams

```json
{
  "title": "Can't See Tralee 2026",
  "description": "**HQ-227: Waiting list emailed and refunded**",
  "fields": [
    {
      "name": ":mag: Task Awaiting Review",
      "value": "This task is ready for review.\n\nAwaiting approval from:\n- Finance Team\n- Delegates",
      "inline": false
    }
  ],
  "author": {
    "icon_url": "https://cdn.discordapp.com/avatars/593915321660735511/8d7a1e962e55995034fde19cfa70a6ec.png",
    "name": "Sean O'Toole"
  }
}
```

Actions:

- View Task
- Approve
- Request Changes
- View Competition
- Dismiss (personal messages only)

Notes:

- This should be sent to required approvers even if they are not already task
  watchers.
- If there are no explicit approvers, this notification should probably not be
  emitted separately from `task_status_changed`.

### `due_date_approaching` - Due Date Approaching

Default watchers:

- Channel watcher: off by default, configurable
- Competition watcher: off by default, configurable
- Task watcher: on

```json
{
  "title": "Can't See Tralee 2026",
  "description": "**HQ-227: Waiting list emailed and refunded**",
  "fields": [
    {
      "name": ":alarm_clock: Due Today",
      "value": "This task is due **today**.",
      "inline": false
    }
  ]
}
```

Actions:

- View Task
- Mark Done
- Snooze (personal messages only)
- View Competition
- Dismiss (personal messages only)

Notes:

- Use `Due Today` when the due date is today.
- Use `Due Soon` when the due date is within the approaching window.
- This should be batched or rate-limited to avoid repeated daily noise.

### `due_date_overdue` - Due Date Overdue

Default watchers:

- Channel watcher: off by default, configurable for urgent/high tasks
- Competition watcher: on for urgent/high tasks, configurable
- Task watcher: on

```json
{
  "title": "Can't See Tralee 2026",
  "description": "**HQ-227: Waiting list emailed and refunded**",
  "fields": [
    {
      "name": ":rotating_light: Task Overdue - 2 Days",
      "value": "This task was due on **2026-05-15**.",
      "inline": false
    }
  ]
}
```

Actions:

- View Task
- Mark Done
- Change Due Date
- Comment
- Dismiss (personal messages only)

Notes:

- Competition/channel delivery should be conservative. Overdue notifications are
  useful, but can become noise if many old tasks are overdue.

### `comment_added` - Comment Added

Default watchers:

- Channel watcher: off by default
- Competition watcher: off by default, configurable
- Task watcher: on

```json
{
  "title": "Can't See Tralee 2026",
  "description": "**HQ-227: Waiting list emailed and refunded**",
  "fields": [
    {
      "name": ":speech_balloon: New Comment",
      "value": "**Sean O'Toole:** The waiting list emails are scheduled for tomorrow morning.",
      "inline": false
    }
  ],
  "author": {
    "icon_url": "https://cdn.discordapp.com/avatars/593915321660735511/8d7a1e962e55995034fde19cfa70a6ec.png",
    "name": "Sean O'Toole"
  }
}
```

Actions:

- View Comment
- Reply
- React
- View Task
- Dismiss (personal messages only)

Notes:

- Show a preview, not the full comment, when the comment is long.
- Mentions and reply notifications should exclude duplicate comment-added
  notifications for the same recipient.

### `comment_replied` - Comment Replied

Default watchers:

- Channel watcher: off
- Competition watcher: off
- Task watcher: off
- Direct recipient: original comment author only

```json
{
  "title": "Can't See Tralee 2026",
  "description": "**HQ-227: Waiting list emailed and refunded**",
  "fields": [
    {
      "name": ":left_speech_bubble: Reply to Your Comment",
      "value": "**Sean O'Toole:** Yes, refunds are included in the same batch.",
      "inline": false
    }
  ],
  "author": {
    "icon_url": "https://cdn.discordapp.com/avatars/593915321660735511/8d7a1e962e55995034fde19cfa70a6ec.png",
    "name": "Sean O'Toole"
  }
}
```

Actions:

- View Comment
- Reply
- React
- View Task
- Dismiss

Notes:

- This should stay targeted. Do not broadcast replies to channel/competition
  watchers by default.

### `relation_blocked` - Task Blocked

Default watchers:

- Channel watcher: remove/off
- Competition watcher: remove/off
- Task watcher: remove/off

Decision: remove this as a standalone user-facing notification.

The planned notification experience should avoid sending a separate "task
blocked" message. Blocking is better shown as task state/context inside task
views, task cards, dashboards, and status change notifications.

If an example is needed for reference only:

```json
{
  "title": "Can't See Tralee 2026",
  "description": "**HQ-227: Waiting list emailed and refunded**",
  "fields": [
    {
      "name": ":construction: Task Blocked",
      "value": "This task is blocked by **HQ-123: Complete competition groups**.",
      "inline": false
    }
  ],
  "author": {
    "icon_url": "https://cdn.discordapp.com/avatars/593915321660735511/8d7a1e962e55995034fde19cfa70a6ec.png",
    "name": "Sean O'Toole"
  }
}
```

Reference actions only:

- View Task
- View Blocker
- View Competition
- Dismiss (personal messages only)

Removal notes:

- Stop channel delivery first.
- Then stop personal delivery or migrate it into a more useful task status /
  health notification.
- Keep `relation_unblocked`, because "this is actionable again" is useful.

### `relation_unblocked` - Task Unblocked

Default watchers:

- Channel watcher: on for high/urgent tasks, configurable
- Competition watcher: on
- Task watcher: on

```json
{
  "title": "Can't See Tralee 2026",
  "description": "**HQ-227: Waiting list emailed and refunded**",
  "fields": [
    {
      "name": ":white_check_mark: Task Unblocked",
      "value": "The blocker **HQ-123: Complete competition groups** was resolved. This task can move again.",
      "inline": false
    }
  ],
  "author": {
    "icon_url": "https://cdn.discordapp.com/avatars/593915321660735511/8d7a1e962e55995034fde19cfa70a6ec.png",
    "name": "Sean O'Toole"
  }
}
```

Actions:

- View Task
- View Former Blocker
- Start Task
- View Competition
- Dismiss (personal messages only)

Notes:

- This is more useful than `relation_blocked` because it tells watchers that work
  can resume.

### `task_approved` - Task Approved

Default watchers:

- Channel watcher: on
- Competition watcher: on
- Task watcher: on

```json
{
  "title": "Can't See Tralee 2026",
  "description": "**HQ-227: Waiting list emailed and refunded**",
  "fields": [
    {
      "name": ":thumbsup: Task Approved - Finance Team",
      "value": "This task was automatically marked as done.\n\nOR\n\nThis task is still awaiting approval from:\n- Delegates\n- Competitions Team",
      "inline": false
    }
  ],
  "author": {
    "icon_url": "https://cdn.discordapp.com/avatars/593915321660735511/8d7a1e962e55995034fde19cfa70a6ec.png",
    "name": "Sean O'Toole"
  }
}
```

Actions:

- View Task
- View Competition
- Dismiss (personal messages only)

Notes:

- If approval completes the task, say that clearly.
- If more approvals are required, list the remaining approvers.
- Do not include an Unapprove action by default unless the user has permission
  and the product decision is that Discord approval withdrawal is acceptable.

### `task_unapproved` - Task Approval Withdrawn

Default watchers:

- Channel watcher: on
- Competition watcher: on
- Task watcher: on

```json
{
  "title": "Can't See Tralee 2026",
  "description": "**HQ-227: Waiting list emailed and refunded**",
  "fields": [
    {
      "name": ":x: Approval Withdrawn - Finance Team",
      "value": "This task is no longer approved by **Finance Team**.\n\nAwaiting approval from:\n- Finance Team\n- Delegates",
      "inline": false
    }
  ],
  "author": {
    "icon_url": "https://cdn.discordapp.com/avatars/593915321660735511/8d7a1e962e55995034fde19cfa70a6ec.png",
    "name": "Sean O'Toole"
  }
}
```

Actions:

- View Task
- Approve (if the recipient can approve)
- Comment
- View Competition
- Dismiss (personal messages only)

Notes:

- This should be explicit because it can reopen work that looked complete.

### `due_date_changed` - Due Date Changed

Default watchers:

- Channel watcher: on for high/urgent tasks, configurable
- Competition watcher: on
- Task watcher: on

```json
{
  "title": "Can't See Tralee 2026",
  "description": "**HQ-227: Waiting list emailed and refunded**",
  "fields": [
    {
      "name": ":calendar: Due Date Changed",
      "value": "Changed from **2026-05-20** to **2026-05-24**.",
      "inline": false
    }
  ],
  "author": {
    "icon_url": "https://cdn.discordapp.com/avatars/593915321660735511/8d7a1e962e55995034fde19cfa70a6ec.png",
    "name": "Sean O'Toole"
  }
}
```

Actions:

- View Task
- Remind Me
- View Competition
- Comment
- Dismiss (personal messages only)

Notes:

- If a due date is added, use `Set to **date**`.
- If a due date is removed, use `Removed due date, previously **date**`.

### `reminder_triggered` - Reminder Triggered

Default watchers:

- Channel watcher: off
- Competition watcher: off
- Task watcher: off
- Direct recipient: reminder owner only

```json
{
  "title": "Can't See Tralee 2026",
  "description": "**HQ-227: Waiting list emailed and refunded**",
  "fields": [
    {
      "name": ":alarm_clock: Reminder",
      "value": "Refund reconciliation needs a final check before the finance call.",
      "inline": false
    }
  ]
}
```

Actions:

- View Task
- Snooze
- Mark Done
- Dismiss

Notes:

- This is a personal notification only.
- If the reminder has no custom message, use the task title and due context.

## Build notes

- Watcher settings need an allowlist per watcher level:
  - channel watcher defaults
  - competition watcher defaults
  - task watcher defaults
- Personal preferences are a final delivery filter, not a subscription source.
- Discord channel messages should use channel watcher settings and should not
  include Dismiss.
- Discord DMs should use personal settings and can include Dismiss.
- Add permission checks before showing action buttons like Approve, Request
  Changes, Mark Done, Change Due Date, and Unapprove.
- Add link targets for comments and progress updates. If the app does not
  support comment/update anchors yet, use the task or competition URL as the
  fallback.
- Add a reaction action for progress updates and comments if Discord reactions
  are meant to write back to HQ reactions.
- Store enough structured notification payload data to render these embeds
  directly instead of trying to reconstruct meaning from plain strings.
- Keep embed text short enough for Discord. Long comments and updates should be
  truncated with a link to HQ.
