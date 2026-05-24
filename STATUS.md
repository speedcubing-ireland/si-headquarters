===== Task Logic Flow =====

Complete = done/cancelled
When referring to flows, the tasks are ordered via their order field with fractional indexing
We look through the tasks, and the earliest uncomplete one is the current tasks, all before that are past and after are future


1. Flows + backlog
2. Phase Making Active
3. Awaiting Review
4. Incomplete Subtasks
5. Manual changes

Available options: backlog, to-do, in-progress, 

// note- when marking a flow subtask as non-backlog this will appear to the user as marking it as whatever the result of the computation would be if this were to happen...
// note- what if an approval is withdrawn in a flow task in the past? it causes a reopen!
// note- if a task is cancelled and an earlier task is reopened, the task gets uncancelled -> backlog - this is acceptable
// note- will need to consider what the implications of notifications are in this... for the future
// note- When we go from complete -> incomplete the parent may require being recomputed
//     - - If this 1st parent is a flow, then we will need to continue this
//     - - If the 1st parent is a flow, and thats parent (2nd parent) is a flow, effectively we will need to reopen the 1st parent too
//     - - This logic continues while the parents are flows
//     
//     - - If the parent is a standard task, it needs to have the incomplete subtask logic run
//     - - if the standard task is a child of a flow, that will also effectively cause a reopening
//
//     - - We will need to traverse the tree upwards, until we reach a parent who's status does not change as a result
// note- the only times we should need to traverse the tree downwards are when
//     - - dealing with a flow's subtasks, and if those subtasks are subtasks
//     - - marking tasks as non-backlog as in the phase setting logic


1. Logic for flows
  - no subtasks = not a flow! need to revert to normal task
  - Cannot manually edit status of any subtask except the current task (outside of the reopen mechanism)
  - If all subtasks are complete, the task is marked as complete unless it has it's own reviewers -> awaiting review
  - - In this case we cannot allow the task's status to be changed to backlog i.e. it is fixed as done/awaiting review

  - Standard computation when task is not backlog
  - - Compute current task
  - - Past tasks before the current task should be complete by definition
  - - Future tasks after the current should be set to backlog
  - - Current task set to to-do if not already to-do/in-progress/awaiting-review
  - - Current task cannot itself be set to backlog, has to be done by setting the parent flow to backlog

  - if task being converted from standard to flow
  - - Note current status (i.e. backlog or not)
  - - Apply standard computation
  - - If was backlog, from there go through logic of going from not backlog to becoming backlog

  - if flow is backlog it stays backlog (i.e. standard computation doesnt run and backlog rules apply)
  - - Cannot change the status of current task

  - if flow not backlog and becoming backlog
  - - Check through subtasks in order
  - - Past subtasks that are complete leave as completed
  - - Current (latest uncomplete) become set to backlog
  - - Future tasks should already be backlog, but set if not otherwise
  - - Flow task (parent of the subtasks) can then become backlog

  - if backlog and setting to start the flow
  - - Current task becomes to-do
  - - Future tasks should stay backlog
  - - Past tasks should be complete by definition
  - - Flow task (parent) can be marked in whatever way as being in the standard mode.

  - completing the current task
  - - Next task gets set to to-do (as cannot be backlog unless flow task is in backlog state)
  - - If that current task is a flow it gets set to not backlog also
  - - If that current task is a standard task with subtasks, those subtasks get marked as to-do if backlog
  - - This is similar logic to the setting new current phase

  - reopening a subtask of a flow can occur:
  - - directly (such as via a button)
  - - indirectly (such as by removing a required review's approval or an override)
  - - - if a task is a subtask of a flow, and the task is complete
  - - - there should be a popup when removing the approval/override alerting the user it will reopen the task
  - - as a side effect
  - - - such as marking a subtask of a flow's subtask as incomplete causes a reopen (or even if its deeper in the chain)
  
  - reopening a subtask of a flow
  - - reopened task is now the current task
  - - reopened task is marked as to-do
  - - standard calculation then applies
  - - tasks in the past of the reopened are left complete
  - - tasks in the future of the reopened (current) are set to backlog (even if already marked complete)


2. Logic for phases
  - setting new current phase
  - - Flows in the new current phase marked as not backlog
  - - Standard tasks in the new current phase marked as to-do if backlog
  - - - This is done recursively for standard tasks (i.e. the subtasks marked as to-do if backlog)
  - - - For flows as subtasks of standard tasks, the flow it's self is marked as not backlog
  - - - - but no more recursion happens as the flow manages it's own status from there.

3. Awaiting review
  - Tasks that have a pending review cannot be marked as done by the user
  - Task + awaiting review + no pending reviews/has override -> done
  - Task + done + pending reviews and no ovveride -> awaiting review
  - Task with reviews can be any of the incomplete statuses (backlog, to-do etc.)
  - This logic should be applied on top of other restrictions and rules (like flows/subtask limitations on status)
  - Removing a review may cause a reopen as above
  - Removing a review will set to awaiting review

4. Incomplete subtasks
  - Standard tasks that have any incomplete subtasks cannot themselves be marked as done/awaiting review
  - - They can be marked as cancelled
  - Uncompleting a subtask may require recomputing the parent per the note above.

5. Manual changes
  - The allowable manual changes may be determined by above rules
  - Allowed manual changes should be displayed in the data-selector 
  - Manual changes should be checked for validity and ensure any side effects are managed
  - Reopening a subtask of a flow cannot be done via the data-selector, unless its a side effect of changing the status of a subtask of a subtask of a flow etc.

Additional QnA for clarity
When a task is marked as `flow` but has no direct subtasks, what should the backend persist?
- Auto mark as standard

If a completed past flow step loses approval or gets a new pending review, what should happen?
- Auto reopen

For performance, how far should this reimplementation go in this pass?
- Read convex performance guideline and consider the best algorithm with this in mind. we dont need to migrate any old code as there is no data in the db we can just rip things out as needed

When a completed past flow step is reopened because review approval/override is withdrawn, what exact status should the reopened current step get?
- Awaiting review

While a flow has an active current step, what manual statuses should be allowed on the flow parent itself?
- It should show backlog, and "Auto Set" in the select options. the value displayed should be the computed one/backlog etc.

Can a flow parent with subtasks be manually marked `cancelled`?
- Yes, this effectively masks the actual state, and does not affect the children

When a task is complete and review requirements are removed, what should happen to its status?
- Recompute normally (as it may make it now awaiting-review -> done)

If every subtask in a standard task or flow is cancelled, what completion status should the parent compute to when it is not manually cancelled?
- Standard tasks won’t change based on this. Flows will all cancelled children are marked as done (or awaiting review if needs reviewers etc.)

For the rewrite, how should we treat persisted task status fields?
- Pick the best option, dont consider what it used to be as a reason, as we are looking for masterful and perfect implementation following best practice of convex and typescript

Should this rewrite include a backend preview API for review/status mutations that would reopen a flow step?
- Yes

Cancelled tasks are terminal for flow progression but cancellation bypasses review approval. Review changes do not reopen cancelled flow steps. Manually reopening a cancelled task restarts it as normal incomplete work.

// Note editing the status of a normal task to the same category (backlog-> awaiting review, done -> cancelled etc. shouldn't cause traversal i think? not sure of the edge cases though just a thought)