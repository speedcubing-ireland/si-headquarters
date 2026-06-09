# Projects, Workflows, and Tasks

Refactor centered around competitions and tasks — redo both into a new project-based paradigm. Integrate different task types and workflows, including some that span beyond a single project.

---

## Views

- [x] Support views based on a particular project, task, or category of projects/tasks
- [x] Support list view, kanban, and other view types with various filters
- [x] Make views configurable (#29)
- [x] Allow views to be shared amongst a team or everyone (e.g. competition schedule view) (#29)
- [ ] Design comprehensive filters — consider each property of projects and tasks and how parenting affects filtering (#29) # Requires filtering by reviewer state and block state

### Specialised Views

- [x] Build hard-coded specialised views with special features where needed

#### Calendar view

- [x] Show a rolling selection of upcoming/recent competitions
- [x] Include empty rows as at present

#### Events view

- [ ] Show what events are being run at what competition # Need to rebuild events view from old project - would be implemented as a plugin like the social media page

---

## Projects

### Project types

- [x] Competitions
- [ ] Perpetual workflow (#74) # This is going to just be a new type of linked integration that is for projects specifically (so can be added to any project, rather than multiple kinds of project)
- [ ] Generic project

### Project usage modes

- [ ] Competitions (shared specifically) # need to implement external organisers
- [ ] Individual (private — including directors etc.) (#10, #11)
- [ ] Shared (multiple individuals/teams) (#10)
- [ ] Team (#10)

### Project properties

- [x] Name
- [x] Description
- [x] Project lead(s)
- [x] Discord channel
- [x] Project updates/status
- [x] Phases (milestones or single overall list)
- [x] Linked integrations and resources
- [ ] Comments

### Competition-specific features

- [x] Set phases
- [x] Dates
- [x] Sponsor
- [x] Linked sheet and WCA page
- [x] Project lead → competition lead, lead delegate, and organisers

### Workflow-specific features

- [ ] Configuration panel

### Workflows

- [ ] Program workflows properly with configurable timelines within the workflow UI (editable only by the lead) (#74)

### Templates

- [x] Create templates that specify certain details automatically
- [x] Support tasks in templates with relative property setting (assignees, due dates, etc.)
- [x] Support adding linked integrations in template competitions (#19)
- [ ] Review current templates and identify what is needed (e.g. Discord threads in socmed) (#15)
- [ ] Look for automation opportunities (see scratch file) (#27)

#### Certificates (ongoing standalone workflow)

- [ ] Trigger based on a set lead time prior to a linked event
- [ ] Link to a competition without a certificate fully ordered
- [ ] Auto-generate sub-tasks when lead time is reached
- [ ] Set sub-task due dates relative to lead time (maybe with business days?)
- [ ] Example: 2.5 weeks before comp without cert:
  - [ ] Follow up certs (maybe auto nudge owners)
  - [ ] Order certs 1.5 week before → nudge again for follow up 0.5w before

### Phases / Milestones

- [x] Mechanism for showing overdue tasks
- [x] Mechanism for showing missed phase tasks
- [x] Task creation UI: allow selecting which phase to link a task to (#12)
- [x] UI: allow drag-dropping tasks into different phases
- [x] Add task from a competition phase — allow picking parent + phase where necessary

---

## Tasks

### Task properties

- [x] Name
- [x] Description
- [x] Owner (team responsible)
- [x] Assignee(s) (who executes the task) (#53)
- [x] Status (Backlog, To-do, In Progress, Awaiting Review/Done, Cancelled)
- [x] Due date
- [x] Block status
- [x] Approvals
- [x] Linked integrations and resources
- [x] Subtasks/flow (configurable)
- [ ] Comments
- [x] Remove priority — To-do = To-do; backlog is for low priority

### Approvals

- [ ] Awaiting review → can mark as not approved with a comment → back to in progress # maybe when comments
- [x] Once all approvals are made, task can be marked as done
- [x] Support partial approval via flow (e.g. approval needed before making an order)
- [ ] "Override approval" button — works but sends a Discord message with reason, shown as tooltip; normal awaiting approval → done mechanism still occurs (#26) # Needs discord message when happens

### Parents, Subtasks, and Flows

- [x] Tasks can be parented to a project (via a phase) or another task
- [x] Tasks can be simple, have subtasks, or follow a flow
- [x] Flow tasks: each step (subtask) must be completed in order (e.g. designed → approved → ordered → arrived/checked)
- [ ] Subtasks can be easily duplicated and rearranged
- [x] Task state in two phases:
  - [x] Backlog — when switched to in progress, changes subtasks to to-do (flow: just the first one)
  - [x] After to-do, state reflects the earliest subtask (to-do, in progress, done, etc.)
- [x] UI for flows with approvals: show as part of timeline/steps?

### Status

- [x] Status may be a select, or influenced by other properties
- [x] Task type (simple/subtask/flow) may set status automatically
- [x] Status may be limited by approval/blocker status
- [x] Implement detail from "specific things that affect status"

### Due date

- [ ] Due date relative to competition date
- [ ] Due date relative to phase target date
- [ ] Due date relative to parent due date
- [x] Configurable pre/post-notification period based on global defaults
- [x] Notification configurable in UI and templates

### Assignee

- [x] Task can be "assignable" (in template/task creation)
- [x] Task creation: "Select assignee(s), make assignable, and no assignee" toggle
- [x] Assignable: when made to-do, team is asked to assign it in Discord (#23)
- [x] Decide: ping relevant team in competition channel vs team channel with link to competition channel
- [x] Embed allows claiming to assign to specific team member (#23)
- [x] Visible in triage column of user dashboards (#23)
- [x] "Nudge assignee" button — friendly tone, via DM (#8)

### Linked Integrations and Resources

- [x] Add via template or UI (#19)
- [x] Show content in notifications (e.g. Canva design in awaiting approval message)

### Notifications

- [x] Design notifications across every aspect of the system (#16)
- [x] Consider how parent/subtask hierarchy appears in notifications
