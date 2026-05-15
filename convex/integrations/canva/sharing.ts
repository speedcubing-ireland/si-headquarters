export type CanvaSharingSetting = "manual";

export function getCanvaSharingOutcome(_sharingSetting: CanvaSharingSetting): {
	sharingRequested: CanvaSharingSetting;
	sharingApplied: boolean;
	warning: string | null;
} {
	return {
		sharingRequested: "manual",
		sharingApplied: false,
		warning: "Manual sharing confirmation is required from the task panel.",
	};
}
