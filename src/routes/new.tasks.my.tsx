import { SharedPageHeader } from '@/components/shared/page-header';
import { TasksDisplaySettings } from '@/components/tasks/display-settings';
import { TasksFilterChips } from '@/components/tasks/filter-chips';
import { Button } from '@/components/ui/button';
import { useDataV2 } from '@/data/data-store-v2';
import type { Task } from '@/data/types-new';
import { useTasksFilterStore } from '@/store/tasks-filter-store';
import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle, CheckCircle2, CheckIcon, Circle, CircleDashed, CircleDot, CircleUser, Dice1, Dice2, Dice3, ListTodo, Plus, TriangleAlert, User, XCircle, type LucideIcon } from 'lucide-react';

import { useState } from "react";
import { SharedFilterPopoverTrigger } from "@/components/shared/filters/filter-popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { UserAvatar } from '@/components/shared/user-avatar';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/new/tasks/my')({
  component: RouteComponent,
})

// export type Task = {
// 	id: string;
// 	identifier: string;
// 	parent: TaskParent;
// 	title: string;
// 	description: string;
// 	owner: Team | User | null;
// 	assignee: User | null;
// 	phase: CompetitionPhase | null;
// 	status: TaskStatus;
// 	priority: TaskPriority;
// 	dueDate: string | null;
// 	requiredApprovalBy: (Team | User)[];
// 	approvedBy: (Team | User)[];
// 	labels: TaskLabel[];
// 	resources: LinkedResource[];
// 	subTasks: Task[];
// 	createdAt: string;
// 	updatedAt: string;
// 	archivedAt: string | null;
// };

// const users = useDataV2((state) => state.users);
// const allTasks = useDataV2((state) => state.tasks);
// const currentUser = users[0];

// const mine = useMemo(
//   () => allTasks.filter((task) => task.assignee?.id === currentUser?.id),
//   [allTasks, currentUser?.id],
// );

// return mine;
// }

type MatchMode = "all" | "any"

type TaskFilterValue = {
  value: string;
  label: string;
} & ({
  iconType: "icon";
  icon: LucideIcon;
} | {
  iconType: "avatar";
  avatarUrl: string;
} | {
  iconType: "none"
})

type FixedTaskFilterValue = {
  type: "fixed",
  values: TaskFilterValue[]
}

type DynamicTaskFilterValue = {
  type: "dynamic",
  getValues: () => TaskFilterValue[]
}

type TaskFilterType = {
  id: string;
  displayName: string;
  displayIcon: LucideIcon,
} & (DynamicTaskFilterValue | FixedTaskFilterValue);

const TASK_FILTER_TYPES: TaskFilterType[] = [
  {
    id: "priority",
    type: "fixed",
    displayName: "Priority",
    displayIcon: Dice2,
    values: [
      { value: "low", label: "Low", iconType: "icon", icon: Dice1 },
      { value: "medium", label: "Medium", iconType: "icon", icon: Dice2 },
      { value: "high", label: "High", iconType: "icon", icon: Dice3 },
      { value: "urgent", label: "Urgent", iconType: "icon", icon: TriangleAlert }
    ],
  },
  {
    id: "status",
    type: "fixed",
    displayName: "Status",
    displayIcon: CheckCircle,
    values: [
      { value: "backlog", label: "Backlog", iconType: "icon", icon: CircleDashed },
      { value: "to-do", label: "To Do", iconType: "icon", icon: Circle },
      { value: "in-progress", label: "In Progress", iconType: "icon", icon: CircleDot },
      { value: "awaiting-review", label: "Awaiting Review", iconType: "icon", icon: CircleUser },
      { value: "done", label: "Done", iconType: "icon", icon: CheckCircle2 },
      { value: "cancelled", label: "Cancelled", iconType: "icon", icon: XCircle },
    ],
  },
  {
    id: "assignee",
    type: "dynamic",
    displayName: "Person",
    displayIcon: User,
    getValues: () => useDataV2(d => d.users).map(u => ({
      value: u.id,
      label: u.name,
      iconType: "avatar",
      avatarUrl: u.avatarUrl
    })),
  }
]

// Look at linear
// When you deselect an item on a filter, and it is the only one - then you should be deleting the filter

function TasksFilterOption({ option }: {
  option: TaskFilterValue
}) {
  const isSelected = false; // selectedValues.includes(value);
  const hasAvatar = option.iconType === "avatar";
  const hasIcon = option.iconType === "icon";
  const OptionIcon = hasIcon && option.icon;

  return (
    <CommandItem
      value={String(option.value)}
      onSelect={() => { }} // onSelect}
      className="flex items-center justify-between"
      key={option.value + option.label}
    >
      <div className="flex items-center gap-2">
        {hasAvatar && (
          <UserAvatar
            name={option.label}
            avatarUrl={option.avatarUrl}
            size="sm"
            alt={option.label}
          />
        )}
        {OptionIcon && <OptionIcon className="size-4 text-muted-foreground" />}
        <span className="text-xs">{option.label}</span>
      </div>
      <CheckIcon
        className={cn(
          "size-4 text-muted-foreground",
          !isSelected && "opacity-0",
        )}
      />
    </CommandItem>
  );
}

function TasksFilterMenuItem({ type }: {
  type: TaskFilterType
}) {
  const DisplayIcon = type.displayIcon;
  const values = type.type === "fixed" ? type.values : type.getValues();
  return (
    <DropdownMenuSub key={type.id}>
      <DropdownMenuSubTrigger>
        <DisplayIcon className="size-4" />
        {type.displayName}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-60 p-0">
        <Command>
          <CommandInput placeholder={"Search"} />
          <CommandList>
            <CommandEmpty>"None..."</CommandEmpty>
            <CommandGroup>
              {values.map((option) => (<TasksFilterOption key={option.value + option.label} option={option} />))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function TasksFilterPopover() {
  const clearFilters = useTasksFilterStore((state) => state.clearFilters);
  const getActiveFiltersCount = useTasksFilterStore(
    (state) => state.getActiveFiltersCount,
  );
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <SharedFilterPopoverTrigger count={getActiveFiltersCount()} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align="start">
        <DropdownMenuGroup>
          {TASK_FILTER_TYPES.map((type) => (<TasksFilterMenuItem key={type.id} type={type} />))}
        </DropdownMenuGroup>
        {getActiveFiltersCount() > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                clearFilters();
                setOpen(false);
              }}
            >
              Clear all filters
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


type FilterSetModel = {
  // These are each individual fiter (i.e. each distinct property, can have a multi-select)
  filters: unknown[]
  matchMode: MatchMode
}

type CompoundView = {
  filterSets: FilterSetModel[][] // matchmode = all collectively
}
// In the popover, all items are displayed as a name +/- an icon/avatar

// TODO: This can be made generalised
function bulkFilterItems(allTasks: Task[], mode: MatchMode, predicates: ((task: Task) => boolean)[]) {
  const isAny = mode === "any";
  const isAll = mode === "all";

  return allTasks.filter(task => {
    for (let predIdx = 0; predIdx < predicates.length; predIdx++) {
      const predicate = predicates[predIdx];
      if (isAny && predicate(task)) return true;
      if (isAll && !predicate(task)) return false;
    }
    return true;
  });
}

function FilterBar() {
  const matchMode = useTasksFilterStore((state) => state.matchMode);
  const toggleMatchMode = useTasksFilterStore((state) => state.toggleMatchMode);
  const hasActiveFilters = useTasksFilterStore(
    (state) => state.hasActiveFilters,
  )

  return (
    <div className="flex min-h-12 shrink-0 items-center gap-2 border-b py-2">
      <div className="flex w-full items-center gap-2 px-4 lg:px-6">
        <div className="flex items-center gap-2 shrink-0">
          <TasksFilterPopover />
        </div>
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <TasksFilterChips />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TasksDisplaySettings />
          {hasActiveFilters() && (
            <Button variant="ghost" size="sm" onClick={toggleMatchMode}>
              {matchMode === "any" ? "Match any filter" : "Match all filters"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function RouteComponent() {
  const users = useDataV2((state) => state.users);
  // TODO: This needs to be linked up with the actual users system
  const currentUser = users[0];
  const myTeams = useDataV2((state) => state.teams).filter(t => t.members.includes(currentUser));
  const myIds = [currentUser.id, ...myTeams.map(t => t.id)];

  const myCompetitions = useDataV2((state) => state.competitions)
    .filter(c => c.compLead?.id === currentUser.id)
    .map(c => c.id);

  const allTasks = useDataV2((state) => state.tasks);
  const pageTasks = bulkFilterItems(allTasks, "any", [
    // Assigned to me
    (t) => t.assignee?.id === currentUser.id,
    // Owned by me/my team
    (t) => t.owner?.id ? myIds.includes(t.owner.id) : false,
    // Awaiting my/my team's approval
    (t) => t.requiredApprovalBy.some(entity => myIds.includes(entity.id)),
    // Within my competiton (as competition lead)
    (t) => t.parent?.type === "competition" && myCompetitions.includes(t.parent.linkedId),
  ]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <SharedPageHeader
        primaryIcon={ListTodo}
        primaryLabel="My tasks"
        addIcon={Plus}
        addLabel="Add task"
        onAdd={() => { }}
        onPrimaryClick={() => { }}
      // onAdd={() => listState.setModalOpen(true)}
      // onPrimaryClick={handleResetToMyTasks}
      />
      <FilterBar />
    </div>
  );
}
