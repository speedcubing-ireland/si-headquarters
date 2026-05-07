import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

/**
 * Throttle outbound email work to stay under Azure Communication Services default quotas
 * (custom verified domain: 30 sends/min, 100 sends/hour by default).
 */
export const emailSendPool = new Workpool(components.emailWorkpool, {
	maxParallelism: 10,
});

