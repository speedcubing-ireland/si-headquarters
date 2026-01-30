import { UserAvatar } from "@/components/shared/user-avatar";
import type { User } from "@/data/types-new";
import type { ReactNode } from "react";

/**
 * Renders a user value for filter chips when you have a user name string.
 * Finds the user by name and renders with avatar + name.
 * Used by competitions filter chips (compLead, leadDelegate, organisers).
 */
export function renderUserValueForFilter(
	value: string,
	users?: User[],
): ReactNode {
	const user = users?.find((u) => u.name === value);
	return (
		<>
			<UserAvatar user={user} name={value} size="xs" />
			{value}
		</>
	);
}

/**
 * Renders a user value for filter chips when you have a user ID string.
 * Finds the user by ID and renders with avatar + name, or "Unknown" if not found.
 * Used by tasks filter chips (assignee).
 */
export function renderUserValueByIdForFilter(
	value: string,
	users: User[],
): ReactNode {
	const user = users.find((u) => u.id === value);
	if (!user) {
		return <span className="text-xs text-muted-foreground">Unknown</span>;
	}

	return <UserAvatar user={user} size="xs" showName nameClassName="text-xs" />;
}
