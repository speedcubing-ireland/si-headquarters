export type SavedViewEntity = "tasks" | "competitions";

export interface SavedView {
	id: string;
	name: string;
	entity: SavedViewEntity;
	pageId: string;
	filtersJson: string;
	displaySettingsJson: string;
	description?: string;
	createdAt: string;
	updatedAt: string;
	lastUsedAt?: string;
}

// This file now only defines shared types for saved views.
