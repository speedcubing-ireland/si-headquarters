import type { Competition, Task } from "@/data/types-new";

export type BreadcrumbEntry = { label: string; to?: string };

function pushParentCrumbs(
	parent: NonNullable<Task["parent"]>,
	tasks: Task[],
	competitions: Competition[],
	chain: BreadcrumbEntry[],
): Task | null {
	if (parent.type === "competition") {
		const comp = competitions.find((c) => c.id === parent.linkedId);
		if (comp) chain.push({ label: comp.name, to: `/competitions/${comp.id}` });
		return null;
	}
	if (parent.type === "phase") {
		const comp = competitions.find((c) =>
			c.phases.some((p) => p.id === parent.linkedId),
		);
		if (comp) {
			chain.push({ label: comp.name, to: `/competitions/${comp.id}` });
			const phase = comp.phases.find((p) => p.id === parent.linkedId);
			if (phase)
				chain.push({ label: phase.name, to: `/competitions/${comp.id}` });
		}
		return null;
	}
	if (parent.type === "task") {
		const parentTask = tasks.find((x) => x.id === parent.linkedId);
		if (!parentTask) return null;
		chain.push({ label: parentTask.title, to: `/tasks/${parentTask.id}` });
		return parentTask;
	}
	return null;
}

export function getTaskBreadcrumbs(
	task: Task,
	tasks: Task[],
	competitions: Competition[],
): BreadcrumbEntry[] {
	const chain: BreadcrumbEntry[] = [];
	let t: Task = task;
	while (t.parent) {
		const next = pushParentCrumbs(t.parent, tasks, competitions, chain);
		if (next === null) break;
		t = next;
	}
	chain.reverse();
	return [
		{ label: "Tasks", to: "/tasks" },
		...chain,
		{ label: task.title },
	];
}
