import { httpAction } from "../_generated/server";
import {
	parseDiscordInteraction,
	verifyDiscordInteractionRequest,
} from "../discord/interactions";
import { requireDiscordPublicKey } from "../discord/config";
import { handleDiscordInteraction } from "../discord/handler";

/**
 * Discord Interactions Endpoint URL.
 * Set in Developer Portal → General → Interactions Endpoint URL:
 *   {CONVEX_SITE_URL}/webhooks/discord/interactions
 */
export const handleDiscordInteractions = httpAction(async (ctx, req) => {
	const rawBody = await req.text();
	const signature = req.headers.get("X-Signature-Ed25519");
	const timestamp = req.headers.get("X-Signature-Timestamp");

	let publicKey: string;
	try {
		publicKey = requireDiscordPublicKey();
	} catch {
		return new Response("Discord public key not configured", { status: 500 });
	}

	const isValid = await verifyDiscordInteractionRequest(
		{ rawBody, signature, timestamp },
		publicKey,
	);
	if (!isValid) {
		return new Response("Invalid request signature", { status: 401 });
	}

	const interaction = parseDiscordInteraction(rawBody);
	return await handleDiscordInteraction(ctx, interaction);
});
