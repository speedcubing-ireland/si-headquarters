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
           submitted         dead_letter        canceled
                │
                ▼
     Azure Event Grid delivery report
                │
                ▼
 delivered | bounced | quarantined | filtered_spam | failed_delivery | suppressed
```

`_enqueueDispatch` (in `convex/emailQueue.ts`) is the single entry point. It deduplicates on `dedupeKey`, persists the dispatch, and enqueues `_sendDispatch` into a Workpool to throttle parallelism. A minute-by-minute sweep is the recovery path if work is delayed; it nudges stale rows through `queued → sending → submitted` (or `dead_letter` on terminal failures).

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

**No blind resends.** A dispatch is tied to one deterministic Azure `Operation-Id`. If a worker crashes between claiming the row and getting a provider response, the sweep re-runs the send action with the same operation id; duplicate-operation or transport failures move the row to `awaiting_provider` so we poll the original Azure operation instead of creating a second email.

**Workpool retries with backoff.** Transient errors while calling Azure are retried by Workpool with exponential backoff. We reuse the same `operationId` for a given send attempt (claimKey) so Azure can de-duplicate if the previous request succeeded but our worker timed out.

**Delivery outcomes are event-driven.** We do not poll for delivery state. Instead, Azure Event Grid `EmailDeliveryReportReceived` updates `emailDispatches.status` to terminal delivery outcomes (delivered/bounced/etc).

**Dead-letter replay.** `_replayDeadLetter` exists as a manual operator hook — it is **not wired to any UI or scheduler**. To replay a failed email today, run it from the Convex dashboard against the `emailDeadLetters` row. It re-enqueues with a fresh dedupe suffix and preserves the original `senderAddress`, recipient, subject, and bodies.

The god-mode admin page (`src/components/admin/god-mode-admin-content.tsx`) lists recent dead letters but has no replay button.

## Source kinds

`sourceKind` on a dispatch is one of `sponsorship`, `notification`, `sponsor_auth`. It drives diagnostics filtering and is the natural axis for routing different sender addresses or templates.

## Tests

- `convex/emailQueue.behavior.test.ts` — enqueue, claim shape, sender address persistence, replay preservation.
- `convex/sponsorAuthServer.test.ts` — OTP email build + sponsorship sender resolution.
- `convex/notifications.behavior.test.ts` — notification → dispatch flow.
