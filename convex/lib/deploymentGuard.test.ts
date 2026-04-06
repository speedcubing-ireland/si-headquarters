import { afterEach, describe, expect, test, vi } from "vitest";
import {
	applyResourcePrefix,
	checkResourceNamingGuard,
	getRequiredResourcePrefix,
	isProductionDeployment,
	validateNonProductionEnvironment,
	validateResourcePrefix,
} from "./deploymentGuard";

// ---------- env helpers ----------

const envKeys = ["DEPLOYMENT_CONTEXT", "WCA_BASE_URL"] as const;

const saved: Record<string, string | undefined> = {};

function saveEnv() {
	for (const k of envKeys) saved[k] = process.env[k];
}
function restoreEnv() {
	for (const k of envKeys) {
		if (saved[k] === undefined) delete process.env[k];
		else process.env[k] = saved[k];
	}
}

// Set up a non-prod baseline used by most tests.
function setNonProdEnv() {
	process.env.DEPLOYMENT_CONTEXT = "development";
	process.env.WCA_BASE_URL = "https://staging.worldcubeassociation.org";
}

// ---------- tests ----------

describe("isProductionDeployment", () => {
	saveEnv();
	afterEach(restoreEnv);

	test("returns true when DEPLOYMENT_CONTEXT=production", () => {
		process.env.DEPLOYMENT_CONTEXT = "production";
		expect(isProductionDeployment()).toBe(true);
	});

	test("returns false when DEPLOYMENT_CONTEXT=development", () => {
		process.env.DEPLOYMENT_CONTEXT = "development";
		expect(isProductionDeployment()).toBe(false);
	});

	test("returns false when DEPLOYMENT_CONTEXT is unset", () => {
		delete process.env.DEPLOYMENT_CONTEXT;
		expect(isProductionDeployment()).toBe(false);
	});

	test("returns false when DEPLOYMENT_CONTEXT is empty string", () => {
		process.env.DEPLOYMENT_CONTEXT = "";
		expect(isProductionDeployment()).toBe(false);
	});
});

describe("getRequiredResourcePrefix", () => {
	saveEnv();
	afterEach(restoreEnv);

	test("returns [DEV] in non-production", () => {
		process.env.DEPLOYMENT_CONTEXT = "development";
		expect(getRequiredResourcePrefix()).toBe("[DEV]");
	});

	test("returns undefined in production", () => {
		process.env.DEPLOYMENT_CONTEXT = "production";
		expect(getRequiredResourcePrefix()).toBeUndefined();
	});
});

describe("validateResourcePrefix", () => {
	test("returns null when name starts with prefix", () => {
		expect(validateResourcePrefix("[DEV] Irish Open 2026", "[DEV]")).toBeNull();
	});

	test("returns error when name does not start with prefix", () => {
		const result = validateResourcePrefix("Irish Open 2026", "[DEV]");
		expect(result).toBeTypeOf("string");
		expect(result).toContain("[DEV]");
		expect(result).toContain("Irish Open 2026");
	});

	test("prefix match is case-sensitive", () => {
		expect(validateResourcePrefix("[dev] Irish Open 2026", "[DEV]")).toBeTypeOf(
			"string",
		);
	});

	test("returns null when name exactly equals the prefix", () => {
		expect(validateResourcePrefix("[DEV]", "[DEV]")).toBeNull();
	});
});

describe("validateNonProductionEnvironment", () => {
	saveEnv();
	afterEach(restoreEnv);

	test("returns the hardcoded prefix when env is valid", () => {
		setNonProdEnv();
		expect(validateNonProductionEnvironment()).toBe("[DEV]");
	});

	test("throws when WCA_BASE_URL is the production URL with www", () => {
		setNonProdEnv();
		process.env.WCA_BASE_URL = "https://www.worldcubeassociation.org";
		expect(() => validateNonProductionEnvironment()).toThrow(/WCA_BASE_URL/);
	});

	test("throws when WCA_BASE_URL is unset (defaults to production)", () => {
		setNonProdEnv();
		delete process.env.WCA_BASE_URL;
		expect(() => validateNonProductionEnvironment()).toThrow(/WCA_BASE_URL/);
	});

	test("returns prefix when WCA_BASE_URL is localhost", () => {
		setNonProdEnv();
		process.env.WCA_BASE_URL = "http://localhost:3000";
		expect(validateNonProductionEnvironment()).toBe("[DEV]");
	});
});

describe("applyResourcePrefix", () => {
	saveEnv();
	afterEach(restoreEnv);

	test("returns title unchanged in production", () => {
		process.env.DEPLOYMENT_CONTEXT = "production";
		expect(applyResourcePrefix("Irish Open 2026")).toBe("Irish Open 2026");
	});

	test("prepends prefix when missing in non-production", () => {
		setNonProdEnv();
		expect(applyResourcePrefix("Irish Open 2026")).toBe(
			"[DEV] Irish Open 2026",
		);
	});

	test("does not double-prefix when already present", () => {
		setNonProdEnv();
		expect(applyResourcePrefix("[DEV] Irish Open 2026")).toBe(
			"[DEV] Irish Open 2026",
		);
	});

	test("prefixes empty string in non-production", () => {
		setNonProdEnv();
		expect(applyResourcePrefix("")).toBe("[DEV] ");
	});
});

describe("checkResourceNamingGuard", () => {
	saveEnv();
	afterEach(restoreEnv);

	test("returns null in production — does not call fetchResourceName", async () => {
		process.env.DEPLOYMENT_CONTEXT = "production";
		const fetchFn = vi.fn();
		const result = await checkResourceNamingGuard({
			resourceType: "Google Sheet",
			resourceId: "abc123",
			fetchResourceName: fetchFn,
		});
		expect(result).toBeNull();
		expect(fetchFn).not.toHaveBeenCalled();
	});

	test("returns null when resource name starts with required prefix", async () => {
		setNonProdEnv();
		const result = await checkResourceNamingGuard({
			resourceType: "Google Sheet",
			resourceId: "abc123",
			fetchResourceName: async () => "[DEV] Irish Open 2026",
		});
		expect(result).toBeNull();
	});

	test("returns error string when resource name does not start with required prefix", async () => {
		setNonProdEnv();
		const result = await checkResourceNamingGuard({
			resourceType: "Google Sheet",
			resourceId: "abc123",
			fetchResourceName: async () => "Irish Open 2026",
		});
		expect(result).toBeTypeOf("string");
		expect(result).toContain("[DEV]");
	});

	test("error message includes actual name and expected prefix", async () => {
		setNonProdEnv();
		const result = await checkResourceNamingGuard({
			resourceType: "Google Sheet",
			resourceId: "FAF-xyz",
			fetchResourceName: async () => "Certificates",
		});
		expect(result).toMatch(/Certificates/);
		expect(result).toMatch(/\[DEV\]/);
	});

	test("propagates error when fetchResourceName rejects", async () => {
		setNonProdEnv();
		await expect(
			checkResourceNamingGuard({
				resourceType: "Google Sheet",
				resourceId: "abc123",
				fetchResourceName: async () => {
					throw new Error("Google API unavailable");
				},
			}),
		).rejects.toThrow("Google API unavailable");
	});

	test("throws cross-validation error when non-production context has production WCA_BASE_URL", async () => {
		process.env.DEPLOYMENT_CONTEXT = "development";
		process.env.WCA_BASE_URL = "https://www.worldcubeassociation.org";
		const fetchFn = vi.fn();
		await expect(
			checkResourceNamingGuard({
				resourceType: "Google Sheet",
				resourceId: "abc123",
				fetchResourceName: fetchFn,
			}),
		).rejects.toThrow(/Non-production deployment safety check failed/);
		expect(fetchFn).not.toHaveBeenCalled();
	});
});
