import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
	CONSUMPTION_NONCE_STORAGE_KEY,
	clearConsumptionNonce,
	getOrCreateConsumptionNonce,
	parseKind,
} from "./login-ticket-utils";

function makeSessionStorageMock() {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => {
			store.clear();
		},
	};
}

function stubBrowserStorage(mock: ReturnType<typeof makeSessionStorageMock>) {
	vi.stubGlobal("window", { sessionStorage: mock });
	vi.stubGlobal("sessionStorage", mock);
}

describe("parseKind", () => {
	test("accepts 'user'", () => {
		expect(parseKind("user")).toBe("user");
	});

	test("accepts 'sponsor'", () => {
		expect(parseKind("sponsor")).toBe("sponsor");
	});

	test("rejects unknown values", () => {
		expect(parseKind("admin")).toBeNull();
		expect(parseKind("")).toBeNull();
		expect(parseKind("USER")).toBeNull();
	});

	test("rejects null", () => {
		expect(parseKind(null)).toBeNull();
	});
});

describe("getOrCreateConsumptionNonce", () => {
	let sessionStorageMock: ReturnType<typeof makeSessionStorageMock>;

	beforeEach(() => {
		sessionStorageMock = makeSessionStorageMock();
		stubBrowserStorage(sessionStorageMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	test("returns a nonce of at least 16 characters", () => {
		const nonce = getOrCreateConsumptionNonce("ticket-abc");
		expect(nonce.length).toBeGreaterThanOrEqual(16);
	});

	test("returns the same nonce for the same ticket on repeated calls (StrictMode idempotency)", () => {
		const first = getOrCreateConsumptionNonce("ticket-strict-mode");
		const second = getOrCreateConsumptionNonce("ticket-strict-mode");
		expect(first).toBe(second);
	});

	test("returns a different nonce for a different ticket", () => {
		const a = getOrCreateConsumptionNonce("ticket-a");
		const b = getOrCreateConsumptionNonce("ticket-b");
		expect(a).not.toBe(b);
	});

	test("generates a fresh nonce when storage holds an entry for a different ticket", () => {
		const nonceA = getOrCreateConsumptionNonce("ticket-a");
		const nonceB = getOrCreateConsumptionNonce("ticket-b");
		expect(nonceA).not.toBe(nonceB);

		// storage should now hold ticket-b's entry
		const raw = sessionStorageMock.getItem(CONSUMPTION_NONCE_STORAGE_KEY);
		const parsed = JSON.parse(raw ?? "") as { ticket: string };
		expect(parsed.ticket).toBe("ticket-b");
	});

	test("ignores malformed storage and regenerates", () => {
		sessionStorageMock.setItem(
			CONSUMPTION_NONCE_STORAGE_KEY,
			"not-valid-json{{",
		);
		const nonce = getOrCreateConsumptionNonce("ticket-xyz");
		expect(nonce.length).toBeGreaterThanOrEqual(16);
	});

	test("ignores stored entry with a nonce shorter than 16 chars", () => {
		sessionStorageMock.setItem(
			CONSUMPTION_NONCE_STORAGE_KEY,
			JSON.stringify({ ticket: "ticket-short", nonce: "tiny" }),
		);
		const nonce = getOrCreateConsumptionNonce("ticket-short");
		expect(nonce).not.toBe("tiny");
		expect(nonce.length).toBeGreaterThanOrEqual(16);
	});
});

describe("clearConsumptionNonce", () => {
	let sessionStorageMock: ReturnType<typeof makeSessionStorageMock>;

	beforeEach(() => {
		sessionStorageMock = makeSessionStorageMock();
		stubBrowserStorage(sessionStorageMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	test("removes the stored entry when the ticket matches", () => {
		getOrCreateConsumptionNonce("ticket-to-clear");
		clearConsumptionNonce("ticket-to-clear");
		expect(
			sessionStorageMock.getItem(CONSUMPTION_NONCE_STORAGE_KEY),
		).toBeNull();
	});

	test("does not remove the entry when the ticket does not match", () => {
		getOrCreateConsumptionNonce("ticket-keeper");
		clearConsumptionNonce("ticket-other");
		expect(
			sessionStorageMock.getItem(CONSUMPTION_NONCE_STORAGE_KEY),
		).not.toBeNull();
	});

	test("is a no-op when storage is empty", () => {
		expect(() => clearConsumptionNonce("any-ticket")).not.toThrow();
	});
});
