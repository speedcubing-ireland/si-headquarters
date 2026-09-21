import { Link } from "@tanstack/react-router"
import {
  Bullets,
  Definitions,
  Note,
  Prose,
  Ui,
} from "@/features/help/help-prose"
import { GettingStartedVideo } from "@/features/help/help-video"

export function HowItFitsTogether() {
  return (
    <Prose>
      <GettingStartedVideo />
      <p>
        Nearly everything in Headquarters hangs off a competition. A competition
        is divided into <Ui>phases</Ui>, each phase holds <Ui>tasks</Ui>, and a
        task can hold <Ui>subtasks</Ui> of its own, as deep as you need.
      </p>
      <Definitions
        items={[
          {
            term: "Competition",
            description:
              "One event, with its dates, its people, and all of the work needed to run it. Projects work the same way for work that is not tied to a competition.",
          },
          {
            term: "Phase",
            description:
              "A stage in the competition's life, such as Concept or Pre-Announcement. Every task lives in exactly one phase, and a competition has one current phase at a time.",
          },
          {
            term: "Task",
            description:
              "A single piece of work. It has a status, an assignee, an owner, labels, and a due date, and it can carry its own description, comments, and links.",
          },
          {
            term: "Subtask",
            description:
              "A task nested under another task. It is a full task in its own right — the only difference is where it sits.",
          },
        ]}
      />
      <p>
        You do not have to build any of this by hand. Creating a competition
        from a template lays out every phase and the tasks that belong in them,
        already assigned and dated, so the first thing you see is a plan rather
        than an empty page.
      </p>
    </Prose>
  )
}

export function StartingACompetition() {
  return (
    <Prose>
      <p>
        <Link to="/competitions" className="underline underline-offset-4">
          Competitions
        </Link>{" "}
        shows one year at a time as a calendar of weekends. Use the arrows in
        the top right to move between years.
      </p>
      <p>
        Every weekend in the year gets a row, whether or not anything is
        happening on it. That is deliberate: it is how you find a free date. On
        any weekend you can leave a note, mark it <Ui>Reserved</Ui> while you
        are still deciding, or mark it <Ui>Announced</Ui> once it is public.
      </p>
      <p>
        When you are ready, use <Ui>New competition</Ui>. You will be asked for:
      </p>
      <Bullets>
        <li>
          A <Ui>template</Ui> — this decides which phases and tasks get created.
        </li>
        <li>
          A <Ui>name</Ui>, an optional description, and the competition dates.
        </li>
        <li>
          The <Ui>competition lead</Ui>, the <Ui>lead delegate</Ui>, and any
          other organisers.
        </li>
        <li>
          Anything else the chosen template asks for. Templates use these
          answers to fill in task owners and due dates, so the more you give
          here the less there is to tidy up afterwards.
        </li>
      </Bullets>
      <Note>
        Due dates from a template are worked out relative to the competition
        dates, so getting the dates right at creation saves rescheduling the
        whole plan later.
      </Note>
    </Prose>
  )
}

export function TheCompetitionPage() {
  return (
    <Prose>
      <p>
        Opening a competition gives you the whole event on one page, in cards
        from top to bottom:
      </p>
      <Definitions
        items={[
          {
            term: "Details",
            description:
              "Name, description, and dates. Edit them here at any time.",
          },
          {
            term: "Properties",
            description:
              "The competition's current phase, along with anything the enabled integrations add.",
          },
          {
            term: "People",
            description:
              "Competition lead, lead delegate, and organisers. Task assignment draws on this list, so keep it current.",
          },
          {
            term: "Competition update",
            description:
              "A short written status for everyone else. This is the place to say what is actually going on, rather than leaving people to infer it from tasks.",
          },
          {
            term: "Phases",
            description:
              "Every phase with its tasks underneath. This is where most of the day-to-day work happens.",
          },
          {
            term: "Comments",
            description: "Discussion about the competition as a whole.",
          },
        ]}
      />
      <p>
        Deleting a competition removes everything it owns — phases, tasks,
        comments, updates, and linked resources — so it asks you to confirm
        first, and only people with permission see the option at all.
      </p>
    </Prose>
  )
}

export function PhaseSections() {
  return (
    <Prose>
      <p>
        The phases card lists each phase as a collapsible section. The header
        tells you where things stand at a glance:
      </p>
      <Bullets>
        <li>
          A <Ui>Current</Ui> badge on the phase the competition is in right now.
        </li>
        <li>
          An <Ui>Overdue</Ui> badge counting tasks in that phase past their due
          date.
        </li>
        <li>
          A count on the right, like <Ui>7/12</Ui>, meaning seven of twelve
          tasks are finished. Cancelled tasks count as finished, because they no
          longer need doing.
        </li>
      </Bullets>
      <p>
        Phases that are complete and not current start collapsed, so what opens
        by default is the work that still needs you.
      </p>
      <p>The toolbar above the sections has four things worth knowing:</p>
      <Definitions
        items={[
          {
            term: "Add task",
            description:
              "Create a task. You choose its parent — a phase, or another task if you want it nested — and can set status, assignee, owner, labels, and due date up front.",
          },
          {
            term: "Edit tasks",
            description:
              "Reorder tasks by dragging, move them between phases, and delete them in bulk. Deleting a task here also deletes everything nested under it.",
          },
          {
            term: "Edit phases",
            description:
              "Change which phase the competition is in, and adjust the phases themselves.",
          },
          {
            term: "Display options",
            description:
              "Hide completed tasks, or hide nested subtasks to see only the top level. This is a personal preference and is remembered for you.",
          },
        ]}
      />
    </Prose>
  )
}

export function WorkingOnATask() {
  return (
    <Prose>
      <p>
        Opening a task gives you a page of its own. The breadcrumbs at the top
        show the whole chain back to the competition, so you always know where a
        task sits even if you arrived from a list.
      </p>
      <p>The properties you set on a task:</p>
      <Definitions
        items={[
          {
            term: "Status",
            description: "Where the work has got to. See the next topic.",
          },
          {
            term: "Assignee",
            description:
              "Who is doing it. A task can have several assignees, or none — an unassigned task is one anybody can pick up.",
          },
          {
            term: "Owner",
            description:
              "Who is accountable for it: a person, or a whole team. Owner and assignee answer different questions — the owner is who to chase, the assignee is who is currently holding it.",
          },
          {
            term: "Labels",
            description:
              "Cross-cutting tags such as Venue, Budget, or Schedule, for finding related work across competitions.",
          },
          {
            term: "Due date",
            description:
              "Drives the overdue badges on phases and in lists. Templates set these for you relative to the competition dates.",
          },
        ]}
      />
      <p>
        The task description takes Markdown, with a preview toggle, so links and
        checklists render properly. Below the properties you will also find
        blockers, reviewers, comments, and any linked resources the integrations
        have attached.
      </p>
      <p>
        If something needs to come back to you later, set a <Ui>reminder</Ui> on
        the task with a date and a short message. You will be notified then, and
        you can cancel it in the meantime.
      </p>
    </Prose>
  )
}

export function StatusRules() {
  return (
    <Prose>
      <p>A task can be in one of six states:</p>
      <Definitions
        items={[
          {
            term: "Backlog",
            description: "Known about, but not part of the current push.",
          },
          { term: "To-do", description: "Ready to be picked up." },
          { term: "In progress", description: "Someone is on it." },
          {
            term: "Awaiting review",
            description:
              "The work is finished but a reviewer still has to approve it.",
          },
          { term: "Done", description: "Finished." },
          {
            term: "Cancelled",
            description:
              "No longer needed. Counts as settled for progress, so it will not hold a phase open.",
          },
        ]}
      />
      <p>
        Some of this is worked out for you, which is the part that surprises
        people:
      </p>
      <Bullets>
        <li>
          A task with unfinished subtasks cannot be marked done. While any
          subtask is outstanding the task reads as <Ui>In progress</Ui>, and{" "}
          <Ui>Done</Ui> is not offered in the menu at all.
        </li>
        <li>
          Completing a task that has reviewers puts it in{" "}
          <Ui>Awaiting review</Ui> rather than <Ui>Done</Ui>. It becomes done
          once every reviewer has approved.
        </li>
        <li>
          <Ui>Cancelled</Ui> always wins, whatever is underneath.
        </li>
      </Bullets>
      <Note>
        If the status you want is missing from the menu, it is because one of
        these rules is in force. Finish or cancel the subtasks, or get the
        review approved, and the option appears.
      </Note>
    </Prose>
  )
}

export function SubtasksAndFlows() {
  return (
    <Prose>
      <p>
        Most tasks hold their subtasks as a plain list, the same way a phase
        holds its tasks, and you can nest as deeply as the work warrants.
      </p>
      <p>
        Some work is not a list, though — it is a sequence, where each step only
        makes sense once the one before it is done. For those, use{" "}
        <Ui>Create flow</Ui> on the task. A flow shows its steps in order along
        a rail, marking which are behind you, which one is current, and which
        are still ahead.
      </p>
      <p>A flow's parent task manages its own status:</p>
      <Bullets>
        <li>
          Left on <Ui>Auto set</Ui>, the parent simply reports the status of the
          current step, so the flow's status is always the status of whatever is
          actually happening.
        </li>
        <li>
          The current step is the first one not yet finished. Complete it and
          the flow moves on by itself.
        </li>
        <li>
          When every step is settled, the flow completes — going to{" "}
          <Ui>Awaiting review</Ui> first if it has reviewers.
        </li>
        <li>
          You can still push the whole flow to <Ui>Backlog</Ui> or{" "}
          <Ui>Cancelled</Ui> by hand.
        </li>
      </Bullets>
      <p>
        Use a list when the order does not matter, and a flow when it does and
        you want the sequence enforced rather than remembered.
      </p>
    </Prose>
  )
}

export function BlockersAndReviewers() {
  return (
    <Prose>
      <p>
        <Ui>Blockers</Ui> record that one task cannot start until another
        finishes. Add them from the blockers card on a task.
      </p>
      <Bullets>
        <li>
          A task waiting on something else is <Ui>blocked</Ui>, and carries a
          badge in every list it appears in. Hover it to see what it is waiting
          for.
        </li>
        <li>
          A task holding others up is <Ui>blocking</Ui>. Finishing it clears the
          badge on everything downstream.
        </li>
        <li>
          Blocked tasks are counted separately in a phase's progress, so you can
          tell work that is genuinely stuck from work nobody has started.
        </li>
      </Bullets>
      <p>
        <Ui>Reviewers</Ui> are for work that someone else has to sign off. Add a
        person or an entire team, and anyone in that team can approve on its
        behalf. Until every reviewer has approved, the task sits in{" "}
        <Ui>Awaiting review</Ui> instead of going done.
      </p>
      <p>
        An approval can be revoked if something was signed off too early. When a
        review genuinely cannot happen — the reviewer is unreachable and the
        competition will not wait — the approval can be overridden instead. The
        override is recorded on the task with who made it, and can be removed
        again, so nothing is quietly waved through.
      </p>
    </Prose>
  )
}

export function FindingYourWork() {
  return (
    <Prose>
      <p>
        <Link to="/tasks" className="underline underline-offset-4">
          Tasks
        </Link>{" "}
        gathers every task across every competition and project. It opens on{" "}
        <Ui>My tasks</Ui>; <Ui>Active</Ui> and <Ui>All</Ui> widen it out.
      </p>
      <p>From there you can shape the list however suits you:</p>
      <Bullets>
        <li>
          Switch between a grouped list and a kanban board, and group by status,
          assignee, owner, competition, phase, due date, and more.
        </li>
        <li>
          Filter on any combination of those, and choose whether tasks must
          match all of your filters or any of them.
        </li>
        <li>
          Save a set of filters as a view once you have one you keep coming back
          to, instead of rebuilding it each time.
        </li>
      </Bullets>
      <p>
        Each team also has its own task list, reachable from the team in the
        sidebar. Those open on <Ui>Active</Ui> and add an <Ui>Unassigned</Ui>{" "}
        preset — the quickest way for a team to see what nobody has picked up
        yet.
      </p>
    </Prose>
  )
}
