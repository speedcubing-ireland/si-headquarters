import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

/**
 * Bound concurrent outbound email work. Send rate pacing lives in enqueue.ts so
 * bursts stay under Azure Communication Services default quotas.
 */
export const emailSendPool = new Workpool(components.emailWorkpool, {
	maxParallelism: 2,
});
