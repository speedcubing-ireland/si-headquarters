/// <reference types="vite/client" />

import { afterEach, beforeEach, vi } from "vitest";

export const modules = import.meta.glob<string[]>("./**/!(*.*.*)*.*s");

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	if (vi.isFakeTimers()) {
		vi.clearAllTimers();
	}
	vi.useRealTimers();
});
