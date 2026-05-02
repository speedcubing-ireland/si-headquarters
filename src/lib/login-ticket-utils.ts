export type LoginTicketKind = "user" | "sponsor";

export const CONSUMPTION_NONCE_STORAGE_KEY =
	"god-mode-impersonation-consumption";

export function parseKind(value: string | null): LoginTicketKind | null {
	if (value === "user" || value === "sponsor") {
		return value;
	}
	return null;
}

export function createConsumptionNonce(): string {
	return crypto.randomUUID();
}

export function getOrCreateConsumptionNonce(ticket: string): string {
	if (!ticket || typeof window === "undefined") {
		return createConsumptionNonce();
	}

	try {
		const raw = window.sessionStorage.getItem(CONSUMPTION_NONCE_STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as { ticket?: string; nonce?: string };
			const stored =
				typeof parsed.nonce === "string" ? parsed.nonce.trim() : "";
			if (parsed.ticket === ticket && stored.length >= 16) {
				return stored;
			}
		}
	} catch {
		// Ignore malformed storage values and regenerate.
	}

	const nonce = createConsumptionNonce();
	try {
		window.sessionStorage.setItem(
			CONSUMPTION_NONCE_STORAGE_KEY,
			JSON.stringify({ ticket, nonce }),
		);
	} catch {
		// Ignore storage failures (e.g. blocked storage); nonce still works in-memory.
	}
	return nonce;
}

export function clearConsumptionNonce(ticket: string): void {
	if (!ticket || typeof window === "undefined") return;
	try {
		const raw = window.sessionStorage.getItem(CONSUMPTION_NONCE_STORAGE_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw) as { ticket?: string };
		if (parsed.ticket === ticket) {
			window.sessionStorage.removeItem(CONSUMPTION_NONCE_STORAGE_KEY);
		}
	} catch {
		// Ignore cleanup failures.
	}
}
