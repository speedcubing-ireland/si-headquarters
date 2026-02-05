import { SharedDisplaySettings } from "@/components/shared/display-settings";
import { useTasksPageContext } from "@/store/tasks-page-context";

const tasksColumnOptions = [
	{ value: "status", label: "Status" },
	{ value: "priority", label: "Priority" },
	{ value: "owner", label: "Owner" },
	{ value: "assignee", label: "Assignee" },
	{ value: "labels", label: "Labels" },
	{ value: "dueDate", label: "Due Date" },
	{ value: "title", label: "Title" },
];

export function TasksDisplaySettings() {
	const { displayStore } = useTasksPageContext();

	return (
		<SharedDisplaySettings
			columnOptions={tasksColumnOptions}
			useDisplaySettingsStore={displayStore}
		/>
	);
}
