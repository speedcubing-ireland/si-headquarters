/// <reference types="vite/client" />

import { afterEach, beforeEach, vi } from "vitest";

export const modules = import.meta.glob<string[]>("./**/!(*.*.*)*.*s");

process.env.AZURE_EMAIL_CONNECTION_STRING ??=
	"endpoint=https://example.communication.azure.com/;accesskey=test";
process.env.EMAIL_SENDER_ADDRESS ??= "noreply@example.com";

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	if (vi.isFakeTimers()) {
		vi.clearAllTimers();
	}
	vi.useRealTimers();
});
