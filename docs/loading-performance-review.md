# Loading performance review

Reviewed on 7 October 2026: user home, competition detail, task detail, global/team task lists, competition calendar, and the Convex readers they use.

## Findings and changes

| Surface                                    | Previous cost                                                                                                                                                         | Change                                                                                                                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                                       | Loaded task trees from inaccessible roots before filtering, scanned every phase and subscription, and hydrated labels/subtask summaries for tasks that never appeared | Load live-root status context, apply canonical root/participant access, read only the viewer's task subscriptions, and hydrate labels/subtask summaries only for selected actions |
| Home work counts                           | Each competition/project scanned the entire task row array                                                                                                            | Group tasks by owner once, then count each owner's rows; the counting pass is linear in owners plus tasks                                                                         |
| Task board flow positions                  | Each flow child rebuilt status views for every sibling                                                                                                                | Reuse the already-built views for the entire sibling group; this removes the quadratic sibling-status work                                                                        |
| Team tasks                                 | Downloaded and hydrated the global task board, then filtered by team in React                                                                                         | Use the task owner index, authorize individual rows, retain complete sibling context, and hydrate only readable team-owned rows                                                   |
| My Tasks                                   | Downloaded and hydrated everyone's tasks before applying the preset                                                                                                   | Derive the viewer on the server, identify affected roots, retain complete hierarchy context, and hydrate only assigned rows                                                       |
| Status-constrained task views              | Hydrated and sent completed/future rows which the view would immediately discard                                                                                      | Push mandatory status constraints ahead of hydration, using effective status including flow positions; OR views retain broad queries                                              |
| Competition calendar                       | Scanned every phase and repeatedly fetched the same leads/organisers across competitions                                                                              | Fetch only distinct referenced current phases and cache user lookup promises for the duration of the query                                                                        |
| Competition/task detail                    | Properties and people/details requests waited for the page-root response                                                                                              | Start essential card queries and the competition subtask query alongside the page-root query, then pass their results into the content components                                 |
| Competition/task subtask trees             | Each sibling waited for the previous sibling's descendants and display joins                                                                                          | Resolve independent sibling branches concurrently and flatten in the original order                                                                                               |
| Task integration picker                    | Subscribed to available integrations on every page visit                                                                                                              | Load options when the picker opens, with explicit loading/empty states                                                                                                            |
| Competition sponsor picker                 | Loaded the sponsor administration list on each page visit solely to populate an editing dropdown                                                                      | Subscribe only while the dropdown is open; retain the current sponsor label from the competition property query                                                                   |
| Sponsor backend imports                    | Plain email copy formatting imported the React Email/Tailwind renderer into sponsor and contact readers                                                               | Put text formatting in a dependency-light module used by copy generation; keep renderer exports compatible                                                                        |
| Competition creation                       | The closed creation dialog subscribed to templates and all users on the calendar page                                                                                 | Fetch these only while the creation dialog is open, with a loading state for templates                                                                                            |
| Task breadcrumbs                           | Read the task again immediately after authorization loaded it                                                                                                         | Reuse the authorized task document                                                                                                                                                |
| Project access                             | Read membership rows before checking a volunteer's unconditional access to global projects                                                                            | Perform the unconditional check first; membership-based checks still apply to other scopes                                                                                        |
| Long task lists, kanban cards and subtasks | Browser laid out and painted every offscreen row                                                                                                                      | Use `content-visibility: auto` with remembered intrinsic-size estimates, while keeping all rows in the document                                                                   |

Live subscriptions, task status rules, saved views, and cross-root blocker resolution remain in use. Scoped boards now explicitly preserve global creation order. Task read permissions match the task page, including participants without root read access; private root summaries remain excluded. No data migration or schema change is required.

The task list pushes only constraints that every result must satisfy. Filters using “match any” cannot safely push one field independently. Overlay edits still use the loaded rows and do not trigger a new board request on every interaction. Named filter chips continue resolving entity names independently of the loaded board rows.

## Verification and evidence

- Convex CLI insights reported no production deployment health issues in the previous 72 hours. This is a health signal, not a page-latency benchmark.
- A 40-task regression fixture verifies that the summary pass queries neither labels nor label assignments. Hydrating one selected row performs one task-label-assignment query and one label document read, and produces the same row as full hydration.
- Scoped-board tests compare team results with filtering the full board, including parent context and completed/current/future flow siblings. An explicit status test ensures a future step with stored `to-do` status is excluded from the effective `to-do` results.
- A participant-access matrix checks assignees, user/team owners and user/team reviewers across private competition and project roots. Task page, board and Home agree; unrelated tasks and private root summaries remain excluded. It covers custom team memberships, combined team/assignment scope and fully hydrated labels.
- An interleaved fixture spanning two competitions and one project verifies that global, team, viewer-assignment and combined/status-constrained boards retain identical creation order.
- Query-filter tests cover conjunction, OR, multiple assignees, negation, and contradictory status filters.
- Parallel-child-query tests ensure a missing competition still renders its empty page and child errors surface after the parent exists.
- Existing home, calendar, nested-task, review, status, blocker, and access tests exercise the shared readers.
- Validation: all four typecheck projects, Oxlint, format check, the production build, and all tests across 137 files pass.

## Strict code-quality re-review

The four reported findings are fixed:

- Board loading has one path, with authorization in the canonical task access module. Complete hierarchy context and authorized output IDs are separate; the reader requires both explicitly.
- `TaskBoardSummary` and `TaskViewTaskSummary` exclude unloaded display fields. Full hydration has a distinct contract; there are no detail-mode flags, fake empty display fields, or silent Home hydration fallbacks. The test-only board wrapper and unused display-row model were removed.
- Root-index results are normalized to creation order before row selection, independently of hierarchy/status resolution.
- Root display context uses the stored `root` and `rootPhase`. Sibling grouping/order comes from the canonical status loader; duplicate parent walks and sorting were removed. Missing context raises an explicit invariant error.

Home loading is separated from classification. Classification and counting use the existing typed phase context instead of repeating positional map arguments. Task-page delete permissions reuse roots already loaded by authorization. No changed file crosses 1,000 lines. The re-review also covered child-query error handling, mandatory-filter pushdown, lazy pickers, email import boundaries and the adjacent status/access logic; no actionable findings remain in that scope.

## Production baseline

Read production completion logs from `oceanic-scorpion-563`, including the user's visits on 7 October 2026 at 06:24–06:25 Europe/Dublin. These are individual Convex execution times on the existing deployed code, including database work. They exclude network transit, client waterfalls and browser rendering; parallel function times must not be added together as page latency. The capture contained 393 completion events and no task-board execution, so the task list has no runtime baseline here.

| Query                              | Execution | Documents read | Read payload | Returned payload |
| ---------------------------------- | --------: | -------------: | -----------: | ---------------: |
| Home `dashboard/queries:getHome`   |  465.6 ms |          1,258 |    454.5 KiB |          5.5 KiB |
| Competition subtasks, first visit  |  293.8 ms |            115 |     42.2 KiB |         28.1 KiB |
| Competition subtasks, second visit |  477.3 ms |            255 |    110.2 KiB |         76.5 KiB |
| Competition calendar               |  132.0 ms |            148 |     32.1 KiB |         11.3 KiB |
| Sponsor administration list        |  361.0 ms |             27 |      7.1 KiB |          0.5 KiB |
| Task page root                     |   62.8 ms |             25 |      6.3 KiB |          0.3 KiB |
| Task details                       |   95.3 ms |             23 |      5.3 KiB |          0.8 KiB |
| Task reviewers                     |  201.6 ms |             21 |      4.5 KiB |          0.1 KiB |
| Task properties                    |  216.2 ms |             26 |      6.2 KiB |          1.4 KiB |
| Task blockers                      |  221.1 ms |             21 |      4.5 KiB |         <0.1 KiB |
| Attached task integrations         |  228.4 ms |             21 |      4.5 KiB |         <0.1 KiB |
| Task flow                          |  257.3 ms |             28 |      6.5 KiB |          2.3 KiB |

The sponsor list spent 335.8 ms in user JavaScript despite its small read set. Tracing imports found `sponsors → email copy → email design → @react-email/components`. Removing that rendering dependency from copy generation reduced a local Bun bundle of the unchanged sponsor query entrypoint from 1,748,998 bytes / 648 modules to 999,129 bytes / 576 modules (42.9% fewer bytes). This supports module initialization as a contributor; it is not a measured production execution improvement. A subsequent cached sponsor query returned in 0 ms, which illustrates why an isolated warm visit cannot establish the uncached cost.

The typecheck script also now propagates a failure from any of its four parallel projects. Previously the final shell `wait` could return success after an earlier project failed.

## Remaining scaling costs

The full “All Tasks” view and OR views still need broad task/hierarchy reads to preserve all filter and grouping results. My Tasks still scans task documents to identify array-based assignees: there is no indexed assignee relation in the current schema. Home also needs this discovery scan for users without global task-management permission, so it can include readable participant tasks in private roots. Task managers use live-root indexes and skip completed/cancelled competition trees. The shared bulk status reader also still scans reviewer, override, and blocker tables to avoid per-task read amplification. Home work totals require all relevant work, and the calendar preserves its existing inclusion of unscheduled and out-of-year competitions.

If deployment measurements show those reads dominating at larger scale, the next structural changes are an indexed task-assignee relation and root-scoped relation indexes/summary records, followed by server-side pagination that preserves filtering and grouping across all results. These require maintaining derived data across assignment changes, moves, template creation, deletion, reviews and blockers, and a migration/backfill. They have not been introduced as part of this change.

There is no claimed end-to-end millisecond speedup: the changed backend has not been deployed or profiled in an authenticated browser. The verified improvements are narrower query scopes, fewer display reads, reduced payloads for constrained task views, fewer sequential loading dependencies, lighter backend imports, and reduced algorithmic/rendering work. After deployment, repeat these same visits and compare uncached function execution time, documents read, returned bytes and browser time until usable content; include a task-list visit and separately check cached revisits.

## Reference

The review follows [Convex's guidance on indexes and broad collections](https://docs.convex.dev/understanding/best-practices/), alongside the repository's generated Convex guidelines and performance skills.
