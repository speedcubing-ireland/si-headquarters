import { UserAvatar } from "@/components/shared/user-avatar";
import type { User } from "@/data/types-new";
import type { ReactNode } from "react";

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
