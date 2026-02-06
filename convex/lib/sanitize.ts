/**
 * Input sanitization utilities for Convex functions
 */

const MAX_STRING_LENGTH = 10000;

/**
 * Sanitizes user input text to prevent XSS and limit length
 */
export function sanitizeText(input: string | undefined | null): string {
	if (input === undefined || input === null) {
		return "";
	}

	return input.trim().replace(/[<>]/g, "").slice(0, MAX_STRING_LENGTH);
}

/**
 * Validates and sanitizes a required text field
 * @throws Error if input is empty after sanitization
 */
export function validateRequiredText(
	input: string | undefined | null,
	fieldName: string,
): string {
	const sanitized = sanitizeText(input);
	if (sanitized.length === 0) {
		throw new Error(`${fieldName} cannot be empty`);
	}
	return sanitized;
}

/**
 * Validates date range
 */
export function validateDateRange(
	startDate: string,
	endDate: string,
): { startMs: number; endMs: number } {
	const startMs = new Date(startDate).getTime();
	const endMs = new Date(endDate).getTime();

	if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
		throw new Error("Invalid date format. Use ISO 8601 format (YYYY-MM-DD)");
	}

	if (endMs < startMs) {
		throw new Error("End date must be after start date");
	}

	return { startMs, endMs };
}

/**
 * Validates email format (basic check)
 */
export function validateEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}
