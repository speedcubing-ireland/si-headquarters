export function computeExponentialBackoffMs(args: {
	attempt: number;
	baseDelayMs: number;
	maxDelayMs: number;
}): number {
	const exponent = Math.max(0, args.attempt - 1);
	return Math.min(args.maxDelayMs, args.baseDelayMs * 2 ** exponent);
}
