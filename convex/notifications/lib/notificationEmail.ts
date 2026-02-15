import type { Id } from "../../_generated/dataModel";
import {
	NotificationTemplates,
	type NotificationTemplateConfig,
} from "./notificationTemplates";
import { formatEntityTypeLabel } from "../../emails/shared";

const demoTask = (
	n: string,
	identifier: string,
	title: string,
	priority: "low" | "medium" | "high" | "urgent" = "medium",
) => ({
	_id: `demo-task-${n}` as Id<"tasks">,
	identifier,
	title,
	priority,
});

const DEMO_TASKS = {
	task1: demoTask("1", "SI-42", "Design competition schedule layout", "high"),
	task2: demoTask("2", "SI-118", "Venue risk checklist"),
	task3: demoTask("3", "SI-201", "Supplier contract review", "high"),
	task4: demoTask("4", "SI-099", "Competitor confirmation emails"),
	task5: demoTask("5", "SI-311", "Final website review"),
	blockingTask: demoTask("6", "SI-180", "Supplier contract pending"),
};

const DEMO_COMPS = {
	comp1: {
		_id: "demo-comp-1" as Id<"competitions">,
		name: "Irish Open 2026",
	},
};

export function buildTestEmailData(appUrl: string, actorName: string) {
	const actor = { actorName };
	const t = DEMO_TASKS;
	const c = DEMO_COMPS;

	const immediateTemplate = NotificationTemplates.task_assigned(t.task1, actor);

	const taskLink = (task: { _id: string }) => `${appUrl}/tasks/${task._id}`;
	const compLink = (comp: { _id: string }) =>
		`${appUrl}/competitions/${comp._id}`;

	const hourlyTemplates = [
		{
			template: NotificationTemplates.comment_added(t.task2, actor),
			link: taskLink(t.task2),
		},
		{
			template: NotificationTemplates.task_status_changed(
				t.task4,
				actor,
				"to-do",
				"in-progress",
			),
			link: taskLink(t.task4),
		},
		{
			template: NotificationTemplates.task_priority_changed(
				t.task5,
				actor,
				"medium",
				"urgent",
			),
			link: taskLink(t.task5),
		},
	];

	const threeDailyTemplates = [
		{
			template: NotificationTemplates.relation_blocked(
				t.task3,
				t.blockingTask,
				actor,
			),
			link: taskLink(t.task3),
		},
		{
			template: NotificationTemplates.progress_update_added(
				c.comp1,
				actor,
				"at-risk",
			),
			link: compLink(c.comp1),
		},
		{
			template: NotificationTemplates.due_date_changed(
				t.task4,
				actor,
				"2026-03-15",
				"2026-03-19",
			),
			link: taskLink(t.task4),
		},
		{
			template: NotificationTemplates.task_approved(t.task5, actor),
			link: taskLink(t.task5),
		},
		{
			template: NotificationTemplates.competition_phase_changed(
				c.comp1,
				actor,
				"Planning",
				"Registration",
			),
			link: compLink(c.comp1),
		},
	];

	const mapItems = (
		entries: Array<{ template: NotificationTemplateConfig; link: string }>,
	) =>
		entries.map(({ template, link }) => ({
			title: template.title,
			message: template.message,
			entityType: formatEntityTypeLabel(template.entityType),
			priority: template.priority,
			actorName,
			link,
		}));

	return {
		immediate: {
			title: immediateTemplate.title,
			message: immediateTemplate.message,
			body: immediateTemplate.body,
			entityType: immediateTemplate.entityType,
			entityId: t.task1._id,
			parentEntityId: undefined,
			actorName,
			priority: immediateTemplate.priority,
		},
		hourly: mapItems(hourlyTemplates),
		threeDaily: mapItems(threeDailyTemplates),
	};
}
