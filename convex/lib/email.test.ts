import { describe, expect, test } from "vitest";
import {
	isAmbiguousEmailTransportError,
	isTransientEmailTransportError,
} from "./email";

describe("email transport transient error classification", () => {
	test("classifies HTTP transient status codes as transient", () => {
		expect(isTransientEmailTransportError({ statusCode: 503 })).toBe(true);
	});

	test("classifies AbortError name as transient", () => {
		expect(
			isTransientEmailTransportError({
				name: "AbortError",
				message: "The operation was aborted.",
			}),
		).toBe(true);
	});

	test("classifies ABORT_ERR code as transient", () => {
		expect(isTransientEmailTransportError({ code: "ABORT_ERR" })).toBe(true);
	});

	test("classifies abort text in message as transient", () => {
		expect(
			isTransientEmailTransportError(
				new Error("The operation was aborted due to request timeout"),
			),
		).toBe(true);
	});

	test("does not classify non-transient errors", () => {
		expect(
			isTransientEmailTransportError({
				statusCode: 400,
				code: "InvalidRequest",
				message: "Bad request",
			}),
		).toBe(false);
	});

	test("classifies timeout-like errors as ambiguous transport errors", () => {
		expect(
			isAmbiguousEmailTransportError({
				name: "AbortError",
				message: "The operation was aborted.",
			}),
		).toBe(true);
	});

	test("does not classify explicit HTTP status errors as ambiguous transport errors", () => {
		expect(
			isAmbiguousEmailTransportError({
				statusCode: 429,
				message: "Too many requests",
			}),
		).toBe(false);
	});
});
