import type { Team, User } from "@/data/types-new";

export function getRoleSelectUsers(
	team: Team | null,
	currentUser: User | null,
): User[] {
	const members = team?.members ?? [];
	if (!currentUser || members.some((u) => u.id === currentUser.id)) {
		return members;
	}
	return [...members, currentUser];
}
