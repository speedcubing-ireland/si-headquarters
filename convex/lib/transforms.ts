import type { Doc, Id } from "../_generated/dataModel";
import type { UserUI, TeamUI, LabelUI, PhaseUI } from "./validators";

export type { UserUI, TeamUI, LabelUI, PhaseUI };

export type MapDBToUI<
	T extends { _id: Id<"users"> | Id<"labels"> | Id<"phases"> },
> = {
	[K in keyof T as K extends "_id"
		? "id"
		: K extends "_creationTime"
			? "createdAt"
			: K]: T[K];
};

export type Lens<T extends { id: string }> = {
	get: (key: T["id"]) => T | undefined;
	getAll: (keys: T["id"][]) => (T | undefined)[];
};

export function createLens<T extends { id: string }>(items: T[]): Lens<T> {
	const map = new Map<T["id"], T>(
		items.map((item) => [item.id as T["id"], item]),
	);
	return {
		get: (id) => map.get(id),
		getAll: (ids) => ids.map((id) => map.get(id)),
	};
}

export const toUser = (doc: Doc<"users">): UserUI => ({
	id: doc._id,
	name: doc.name ?? "",
	avatarUrl: doc.image ?? "",
});

export const toLabel = (doc: Doc<"labels">): LabelUI => ({
	id: doc._id,
	name: doc.name,
	color: doc.color,
});

export const toPhase = (doc: Doc<"phases">): PhaseUI => ({
	id: doc._id,
	name: doc.name,
	description: doc.description,
});

export const toUsers = (docs: (Doc<"users"> | null)[]): UserUI[] =>
	docs.filter((d): d is Doc<"users"> => d !== null).map(toUser);

export const toLabels = (docs: (Doc<"labels"> | null)[]): LabelUI[] =>
	docs.filter((d): d is Doc<"labels"> => d !== null).map(toLabel);

export const toPhases = (docs: (Doc<"phases"> | null)[]): PhaseUI[] =>
	docs.filter((d): d is Doc<"phases"> => d !== null).map(toPhase);

export const toUserMap = (
	_ids: Id<"users">[],
	docs: (Doc<"users"> | null)[],
): Map<Id<"users">, UserUI> =>
	new Map(toUsers(docs).map((user) => [user.id, user]));

export const toLabelMap = (
	_ids: Id<"labels">[],
	docs: (Doc<"labels"> | null)[],
): Map<Id<"labels">, LabelUI> =>
	new Map(toLabels(docs).map((label) => [label.id, label]));

export const toPhaseMap = (
	_ids: Id<"phases">[],
	docs: (Doc<"phases"> | null)[],
): Map<Id<"phases">, PhaseUI> =>
	new Map(toPhases(docs).map((phase) => [phase.id, phase]));

export const extractMemberIds = (
	teamDocs: (Doc<"teams"> | null)[],
): Set<Id<"users">> => {
	const memberIds = new Set<Id<"users">>();
	for (const team of teamDocs) {
		if (team) {
			for (const mid of team.memberIds) {
				memberIds.add(mid);
			}
		}
	}
	return memberIds;
};

export const buildTeamsWithMembers = (
	teamIds: Id<"teams">[],
	teamDocs: (Doc<"teams"> | null)[],
	memberMap: Map<Id<"users">, UserUI>,
): Map<Id<"teams">, TeamUI> =>
	new Map(
		teamIds
			.map((id, i) => {
				const team = teamDocs[i];
				if (!team) return null;
				return [
					id,
					{
						id,
						name: team.name,
						members: team.memberIds
							.map((mid) => memberMap.get(mid))
							.filter((u): u is UserUI => Boolean(u)),
					},
				] as [Id<"teams">, TeamUI];
			})
			.filter((entry): entry is [Id<"teams">, TeamUI] => entry !== null),
	);

export const toISO = (ms: number): string => new Date(ms).toISOString();
