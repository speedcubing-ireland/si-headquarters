import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ConvexError } from "convex/values";
import { toast } from "sonner";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

function getErrorMessage(error: unknown): string {
	if (error instanceof ConvexError) {
		const data = error.data;
		if (typeof data === "string") return data;
		if (data && typeof data === "object" && "message" in data) {
			return String(data.message);
		}
		return "Something went wrong";
	}
	if (error instanceof Error) return error.message;
	return "Something went wrong";
}

export function onMutationError(error: unknown): void {
	toast.error(getErrorMessage(error));
}

export function pickDefined<T extends Record<string, unknown>>(
	obj: T,
): Partial<T> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value !== undefined) result[key] = value;
	}
	return result as Partial<T>;
}
