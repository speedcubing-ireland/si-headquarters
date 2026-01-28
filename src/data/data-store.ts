import { identicon } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { faker } from "@faker-js/faker";
import { create } from "zustand";
import type { Priority, Project, Status, Team, User } from "./types";
import type {
	CompetitionsFilters,
	MatchMode,
} from "@/store/competitions-filter-types";
import {
	filterCompetitionsWithState,
} from "@/lib/competitions-filters";

const avatarUrl = (seed: string): string => {
	const avatar = createAvatar(identicon, {
		seed,
		backgroundColor: ["ffffff"],
	});
	const svg = avatar.toString();
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

function generateUsers(count: number): User[] {
	return Array.from({ length: count }, () => {
		const name = faker.person.fullName();
		// Use normalized name as seed for consistent avatars
		const seed = name.toLowerCase().replace(/\s+/g, "");
		return {
			name,
			avatarUrl: avatarUrl(seed),
		};
	});
}

function generateTeams(count: number): Team[] {
	return Array.from({ length: count }, () => ({
		name: faker.company.name(),
	}));
}

function generateCompetitions(
	count: number,
	users: User[],
	teams: Team[],
): Project[] {
	const statuses: Status[] = [
		"concept",
		"pre-announcement",
		"post-announcement",
		"pre-competition",
		"post-competition",
		"archive",
	];

	const priorities: Priority[] = ["low", "medium", "high", "urgent"];

	return Array.from({ length: count }, () => {
		const competitionNames = [
			"Irish Open",
			"Dublin Championship",
			"Cork Speedcubing Competition",
			"Galway Cube Challenge",
			"Belfast Open",
			"Limerick Championship",
			"Waterford Speedcubing",
			"Kilkenny Cube Fest",
			"Wexford Open",
			"National Championships",
		];

		const year = faker.date.future().getFullYear();
		const name = `${faker.helpers.arrayElement(competitionNames)} ${year}`;

		const numLeads = faker.number.int({ min: 1, max: 2 });
		const leads = faker.helpers.arrayElements(users, numLeads);

		const ownerType = faker.datatype.boolean() ? "user" : "team";
		const owner =
			ownerType === "user"
				? faker.helpers.arrayElement(users)
				: faker.helpers.arrayElement(teams);

		const startDate = faker.date.future();
		const percentComplete = faker.number.int({ min: 0, max: 100 });

		return {
			id: faker.string.uuid(),
			type: "competition" as const,
			name,
			leads,
			owner,
			status: faker.helpers.arrayElement(statuses),
			priority: faker.helpers.arrayElement(priorities),
			percentComplete,
			startDate: startDate.toISOString().split("T")[0],
			tasks: [],
		};
	});
}

const mockUsers = generateUsers(10);
const mockTeams = generateTeams(5);
const mockCompetitions = generateCompetitions(15, mockUsers, mockTeams);

type FilterState = CompetitionsFilters & {
	matchMode?: MatchMode;
};

type DataStore = {
	competitions: Project[];
	users: User[];
	teams: Team[];
	getCompetitions: () => Project[];
	getUsers: () => User[];
	getTeams: () => Team[];
	updateCompetition: (id: string, updates: Partial<Project>) => void;
	updateCompetitionStatus: (id: string, status: Status) => void;
	updateCompetitionPriority: (id: string, priority: Priority) => void;
	updateCompetitionLeads: (id: string, leads: User[]) => void;
	filterCompetitions: (filters: FilterState) => Project[];
};

export const useData = create<DataStore>((set, get) => ({
	competitions: mockCompetitions,
	users: mockUsers,
	teams: mockTeams,
	getCompetitions: () => get().competitions,
	getUsers: () => get().users,
	getTeams: () => get().teams,
	updateCompetition: (id: string, updates: Partial<Project>) => {
		set((state) => ({
			competitions: state.competitions.map((comp) =>
				comp.id === id ? { ...comp, ...updates } : comp,
			),
		}));
	},
	updateCompetitionStatus: (id: string, status: Status) => {
		set((state) => ({
			competitions: state.competitions.map((comp) =>
				comp.id === id ? { ...comp, status } : comp,
			),
		}));
	},
	updateCompetitionPriority: (id: string, priority: Priority) => {
		set((state) => ({
			competitions: state.competitions.map((comp) =>
				comp.id === id ? { ...comp, priority } : comp,
			),
		}));
	},
	updateCompetitionLeads: (id: string, leads: User[]) => {
		set((state) => ({
			competitions: state.competitions.map((comp) =>
				comp.id === id ? { ...comp, leads } : comp,
			),
		}));
	},
	filterCompetitions: (filters: FilterState) => {
		const { competitions } = get();
		return filterCompetitionsWithState(competitions, filters);
	},
}));
