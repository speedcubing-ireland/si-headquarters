import { afterEach, beforeEach, vi } from "vitest";

export const modules = import.meta.glob("./**/!(*.*.*)*.*s");

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	if (vi.isFakeTimers()) {
		vi.clearAllTimers();
	}
	vi.useRealTimers();
});
