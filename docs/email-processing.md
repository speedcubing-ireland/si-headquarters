# Email Processing

How outbound email is queued, sent, and recovered from failure.

## Pipeline

```
caller → _enqueueDispatch → emailDispatches (queued)
                                  │
                                  ▼
                    runSweep (claims due rows)
                                  │
                                  ▼
                  _sendDispatch (Azure beginSend)
                ┌─────────────────┼─────────────────┐
                ▼                 ▼                 ▼
              sent       awaiting_provider     dead_letter
                                  │
                                  ▼
                          _pollDispatch
```

`_enqueueDispatch` (in `convex/emailQueue.ts`) is the single entry point. It deduplicates on `dedupeKey`, persists the dispatch, and schedules `_runSweep`. The sweep moves rows through `queued → sending → awaiting_provider → sent | dead_letter`.

## Sender address

Each dispatch row carries an optional `senderAddress`. Resolution at send time:

1. `dispatch.senderAddress` if set
2. otherwise `EMAIL_SENDER_ADDRESS` env var

Sponsorship and sponsor-auth callers pass `getSponsorshipSenderAddress()` (`convex/lib/email.ts`), which reads `SPONSORSHIP_EMAIL_SENDER_ADDRESS` and falls back to `sponsorship@speedcubingireland.com`.

To add a new sender for another source, add a helper alongside `getSponsorshipSenderAddress` and pass `senderAddress` to `_enqueueDispatch`. The address must be configured in the Azure Communication Services email domain.

## Env variables

| Var | Purpose |
|---|---|
| `AZURE_EMAIL_CONNECTION_STRING` | Azure Communication Services credential |
| `EMAIL_SENDER_ADDRESS` | Default From: address |
| `SPONSORSHIP_EMAIL_SENDER_ADDRESS` | Override for sponsorship + sponsor-auth (optional; defaults in code) |

## Failure handling

**No automatic retries.** A dispatch gets exactly one provider send attempt. If the worker crashes between claiming the row and getting a provider response, the row is dead-lettered with `no_auto_resend_policy_enforced` on the next sweep — we do not re-attempt blindly because Azure may have already accepted the message.

**Provider state unknown.** If `awaiting_provider` rows can't be resolved within 24h (`PROVIDER_UNKNOWN_TIMEOUT_MS` in `worker.ts`), they dead-letter with `provider_state_unknown_no_resend`.

**Dead-letter replay.** `_replayDeadLetter` exists as a manual operator hook — it is **not wired to any UI or scheduler**. To replay a failed email today, run it from the Convex dashboard against the `emailDeadLetters` row. It re-enqueues with a fresh dedupe suffix and preserves the original `senderAddress`, recipient, subject, and bodies.

The god-mode admin page (`src/components/admin/god-mode-admin-content.tsx`) lists recent dead letters but has no replay button.

## Source kinds

`sourceKind` on a dispatch is one of `sponsorship`, `notification`, `sponsor_auth`. It drives diagnostics filtering and is the natural axis for routing different sender addresses or templates.

## Tests

- `convex/emailQueue.behavior.test.ts` — enqueue, claim shape, sender address persistence, replay preservation.
- `convex/sponsorAuthServer.test.ts` — OTP email build + sponsorship sender resolution.
- `convex/notifications.behavior.test.ts` — notification → dispatch flow.
