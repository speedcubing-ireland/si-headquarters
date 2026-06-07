## Projects, Workflows, and Tasks

This is a refactor centered around the core aspects of this project: competitions and tasks.

Fundamentally we are going to redo competitions and tasks into a new project based paradigm. This will also integrate different types of tasks and different workflows - some of which span beyond just one particular project.

# Views

Views may be based on a particular project, task, or category of project/tasks etc.

This may mean a list view, kanban etc. with various filters

Views should be configurable and be able to set as shared amongst a team/everyone (e.g a competition schedule view) (#29)

Filters should be comprehensive. Will require thinking about each property of both projects and tasks and considering how parenting will affect it (#29)

## Specialised Views

Some hard coded specialised views will exist some with special features.

### Calendar view

This will show a rolling selection of upcoming/recent competitions with empty rows like we have at present

### Events view

This will show what events are being run at what competition

# Projects

There are 3 types of project:

- Competitions
- Perpetual workflow (#74)
- Generic Project

These get used in 4 different ways:

- Competitions (shared specifically)
- Individual (private - including directors etc.) (#10, #11)
- Shared (multiple individuals/teams) (#10)
- Team (#10)

Projects will have a number of properties:

- Name
- Description
- Project Lead(s)
- Discord Channel
- Project updates/status
- Phases (milestones or single overall list)
- Linked integrations and resources
- Comments

Specific Features:

- Competitions:
- - Set Phases
- - Dates
- - Sponsor
- - Linked sheet and WCA page
- - Project Lead -> Competition Lead, Lead delegate and Organisers
- Workflows:
- - Configuration Panel

## Workflows

These will likely get programmed properly with configurable timelines within the workflow UI (editable only by the lead) (#74)

## Templates

We will have templates that specify certain details automatically. It will also allow having tasks and have relative property setting for things such as assignees, due-dates etc.

Support adding linked integrations in template competitions (#19)

We will also do a review of the current templates and see what is needed e.g. discord threads in socmed (#15)

At the same time as this we can look for opportunities for automation (see scratch file). (#27)

### Certificates

This is an ongoing standalone workflow
It is triggered based on a set 'lead time' prior to a linked event
The linked event is a competition without a certificate fully ordered
Has multiple sub-tasks that get auto-generated when its time for the lead time
Sub tasks are due relative to the lead time (maybe with buisness days?)
e.g. 2.5 weeks before comp without cert:

- Follow up certs (maybe auto nudge owners)
- Order certs 1.5 week before -> nudge again for follow up .5w before

## Phases/Milestones

// TODO
need to have a mechanisms for showing 1. overdue tasks and 2. missed phase tasks
The task creation UI will also allow selecting what phase to link it to (#12)
The UI will allow drag-dropping tasks into different phases
Add task from a competition phase - allow picking parent + phase where necessary

# Tasks

Properties:

- Name
- Description
- Owner (i.e. what team is responsible)
- Assignee(s) (i.e. who executes the task) (#53)
- Status (Backlog, To-do, In Progress, Awaiting Review/Done, Cancelled)
- Due date
- Block status
- Approvals
- Linked integrations and resources
- Subtasks/Flow (configurable)
- Comments

Note: Priority will be removed. To-do = To-do and backlog is for low priority

## Approvals

Awaiting review -> Can mark as not approved with a comment -> back to in progress
Once all approvals are made the task can be marked as done
^ Ideally if a task has only a part that needs approval e.g. before making an order, it can be made a flow

May want a button to 'override approval' which works but just sends a message in the discord with a reason why it was done and shown as a tooltip. This will still mean that the normal mechanism of awaiting approval -> done occurs (#26)

## Parents, Subtasks, and Flows

Tasks can be parented to a project (via a phase) or another task.
Tasks can be simple, have subtasks, or follow a 'flow'
Flow tasks require each step (subtask) to be completed in order. For example items being designed (then approved) then ordered, then arrived/checked
Subtasks can be easily duplicated, rearranged

For any task (subtask/flow) it's state is in 2 phases:

- 1. Backlog (when switched to inprogress it changes subtasks to to-do unless flow then just the first one)
- 2. After todo it goes to the state of the earliest subtask (e.g. todo inprogress done etc.)

Perhaps the UI for a flow that includes approvals can show this as part of the timeline/steps?

## Status

Status may be just a select, or be influences by other properties.
The type of task (simple/subtask/flow) may set it automatically
It may be limited based on items such as approval/blocker status

There is further detail on this in the specific things that affect status.

## Due date

Due date can be relative to:

- Competiton date
- Phase target date
- Parent due date
  With configurable pre/post-notification period based on global defaults
  Notification can be configurable in UI and the templates.

## Assignee

Task can be 'assignable' (in template/task creation)
Task creation will have a "Select assignee(s), make assignable, and no assignee" toggle
Assignable means when made to-do the team is asked to assign it in discord (#23)
? unclear if this should ping the relevent team in the competition's channel or in the team channel with a link to the competition channel
The embed will allow claiming to assign to specific team member (#23)
This will also be visible in a triage column of users dashboards (#23)
There should be a button to nudge an assignee on a task - this is a friendly thing and should be conveyed as such and done via DM (#8)

## Linked Integrations and Resources

These can be added via the template or the UI (#19)
These may be able to show content in notifications such as showing a canva design in an awaiting approval message

## Notifications

TODO (#16)
Consider notifications in every aspect of the whole system...
Will need to consider how parents/subtask hierarchy shows in notifications
