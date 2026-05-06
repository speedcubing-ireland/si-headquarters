import { EmailClient, KnownEmailSendStatus } from "@azure/communication-email";
import { v5 as uuidv5 } from "uuid";

type EmailRecipient = {
	address: string;
	displayName?: string;
};

type SendEmailInput = {
	to: EmailRecipient[];
	subject: string;
	html: string;
	plainText: string;
	operationId?: string;
	senderAddress?: string;
};

export type EmailSendProgress = {
	operationId: string;
	status: KnownEmailSendStatus;
	retryAfterMs: number;
	error?: string;
};

let cachedClient: EmailClient | null = null;

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Used when Azure omits Retry-After on the send/poll response. */
export const FALLBACK_RETRY_AFTER_MS = 15_000;
const MIN_POLL_INTERVAL_MS = 5_000;
const MAX_POLL_INTERVAL_MS = 60_000;
const EMAIL_REQUEST_TIMEOUT_MS = 15_000;
const EMAIL_OPERATION_ID_NAMESPACE = "9ef7006e-65ca-4f75-861f-f61f7cdafd84";

function getEmailClient(): EmailClient {
	if (cachedClient) return cachedClient;
	const connectionString = process.env.AZURE_EMAIL_CONNECTION_STRING;
	if (!connectionString) {
		throw new Error(
			"AZURE_EMAIL_CONNECTION_STRING environment variable is not set",
		);
	}
	cachedClient = new EmailClient(connectionString);
	return cachedClient;
}

function getSenderAddress(): string {
	const sender = process.env.EMAIL_SENDER_ADDRESS?.trim();
	if (!sender) {
		throw new Error("EMAIL_SENDER_ADDRESS environment variable is not set");
	}
	return sender;
}

const DEFAULT_SPONSORSHIP_SENDER_ADDRESS = "sponsorship@speedcubingireland.com";

export function getSponsorshipSenderAddress(): string {
	return (
		process.env.SPONSORSHIP_EMAIL_SENDER_ADDRESS?.trim() ||
		DEFAULT_SPONSORSHIP_SENDER_ADDRESS
	);
}

function toValidOperationId(
	operationId: string | undefined,
): string | undefined {
	if (!operationId) return undefined;
	const trimmed = operationId.trim();
	if (!trimmed) return undefined;
	return UUID_REGEX.test(trimmed) ? trimmed.toLowerCase() : undefined;
}

function toClampedRetryAfterMs(retryAfterSeconds: number | undefined): number {
	const retryAfterMs =
		typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds)
			? retryAfterSeconds * 1000
			: FALLBACK_RETRY_AFTER_MS;
	return Math.max(
		MIN_POLL_INTERVAL_MS,
		Math.min(MAX_POLL_INTERVAL_MS, retryAfterMs),
	);
}

function createRandomUUID(): string {
	const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
	if (!randomUUID) {
		throw new Error(
			"Unable to generate operationId (crypto.randomUUID missing)",
		);
	}
	return randomUUID();
}

export function createEmailOperationId(): string {
	return createRandomUUID().toLowerCase();
}

export function buildDeterministicEmailOperationId(seed: string): string {
	return uuidv5(seed, EMAIL_OPERATION_ID_NAMESPACE);
}

function toResolvedOperationId(operationId: string | undefined): string {
	const validOperationId = toValidOperationId(operationId);
	if (validOperationId) {
		return validOperationId;
	}
	return createEmailOperationId();
}

export function emailErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return "Unknown email error";
}

export function isTransientEmailTransportError(error: unknown): boolean {
	if (!error || typeof error !== "object") {
		return false;
	}

	const maybeError = error as {
		statusCode?: unknown;
		code?: unknown;
		message?: unknown;
		name?: unknown;
	};
	const statusCode =
		typeof maybeError.statusCode === "number" ? maybeError.statusCode : null;
	if (
		statusCode !== null &&
		(statusCode === 408 ||
			statusCode === 429 ||
			statusCode === 500 ||
			statusCode === 502 ||
			statusCode === 503 ||
			statusCode === 504)
	) {
		return true;
	}

	const code =
		typeof maybeError.code === "string" ? maybeError.code.toLowerCase() : "";
	const name =
		typeof maybeError.name === "string" ? maybeError.name.toLowerCase() : "";
	if (
		code === "origintimeout" ||
		code === "gatewaytimeout" ||
		code === "requesttimeout" ||
		code === "etimedout" ||
		code === "econnreset" ||
		code === "econnrefused" ||
		code === "enotfound" ||
		code === "abort_err" ||
		name === "aborterror" ||
		name === "timeouterror"
	) {
		return true;
	}

	const message = emailErrorMessage(error).toLowerCase();
	return (
		message.includes("the operation was aborted") ||
		message.includes("gateway timeout") ||
		message.includes("origin timeout") ||
		message.includes("service unavailable") ||
		message.includes("timed out") ||
		message.includes("operationid already exists") ||
		message.includes("operation id already exists") ||
		message.includes("status code 504") ||
		message.includes("status code 503")
	);
}

export function isAmbiguousEmailTransportError(error: unknown): boolean {
	if (!error || typeof error !== "object") {
		return false;
	}
	const maybeError = error as {
		statusCode?: unknown;
		code?: unknown;
		name?: unknown;
	};
	if (typeof maybeError.statusCode === "number") {
		return false;
	}
	const code =
		typeof maybeError.code === "string" ? maybeError.code.toLowerCase() : "";
	const name =
		typeof maybeError.name === "string" ? maybeError.name.toLowerCase() : "";
	if (
		code === "origintimeout" ||
		code === "gatewaytimeout" ||
		code === "requesttimeout" ||
		code === "etimedout" ||
		code === "econnreset" ||
		code === "econnrefused" ||
		code === "enotfound" ||
		code === "abort_err" ||
		name === "aborterror" ||
		name === "timeouterror"
	) {
		return true;
	}
	const message = emailErrorMessage(error).toLowerCase();
	return (
		message.includes("the operation was aborted") ||
		message.includes("gateway timeout") ||
		message.includes("origin timeout") ||
		message.includes("timed out") ||
		message.includes("status code 504")
	);
}

function toEmailMessage(input: SendEmailInput) {
	return {
		senderAddress: input.senderAddress?.trim() || getSenderAddress(),
		content: {
			subject: input.subject,
			html: input.html,
			plainText: input.plainText,
		},
		recipients: {
			to: input.to,
		},
	};
}

function createRequestAbortSignal(timeoutMs: number): AbortSignal | undefined {
	if (
		typeof AbortSignal !== "undefined" &&
		typeof AbortSignal.timeout === "function"
	) {
		return AbortSignal.timeout(timeoutMs);
	}
	return undefined;
}

type InternalEmailClient = {
	generatedClient: {
		email: {
			getSendResult: (
				operationId: string,
				options?: { abortSignal?: AbortSignal },
			) => Promise<{
				id: string;
				status: string;
				retryAfter?: number;
				error?: { message?: string; code?: string };
			}>;
		};
	};
};

/**
 * Submits the email once via Azure `beginSend`. The SDK performs one initial poll
 * internally; do not call `poller.poll()` again here.
 */
export async function submitEmail(
	input: SendEmailInput,
): Promise<EmailSendProgress> {
	const client = getEmailClient();
	const abortSignal = createRequestAbortSignal(EMAIL_REQUEST_TIMEOUT_MS);
	const operationId = toResolvedOperationId(input.operationId);
	const poller = await client.beginSend(toEmailMessage(input), {
		operationId,
		...(abortSignal ? { abortSignal } : {}),
	});
	const result = poller.getResult() ?? poller.getOperationState().result;
	if (!result) {
		throw new Error("Email beginSend returned no operation result");
	}
	return {
		operationId: result.id,
		status: result.status as KnownEmailSendStatus,
		retryAfterMs: toClampedRetryAfterMs(result.retryAfter),
		error: result.error?.message ?? result.error?.code,
	};
}

export async function pollEmailSendOperation(
	operationId: string,
): Promise<EmailSendProgress> {
	const validOperationId = toValidOperationId(operationId);
	if (!validOperationId) {
		throw new Error("Invalid email operationId");
	}
	const client = getEmailClient();
	const internalClient = client as unknown as InternalEmailClient;
	const abortSignal = createRequestAbortSignal(EMAIL_REQUEST_TIMEOUT_MS);
	const result = await internalClient.generatedClient.email.getSendResult(
		validOperationId,
		abortSignal ? { abortSignal } : undefined,
	);
	return {
		operationId: result.id ?? validOperationId,
		status: result.status as KnownEmailSendStatus,
		retryAfterMs: toClampedRetryAfterMs(result.retryAfter),
		error: result.error?.message ?? result.error?.code,
	};
}

export async function sendEmail(input: SendEmailInput): Promise<string> {
	const client = getEmailClient();
	const operationId = toValidOperationId(input.operationId);
	const poller = await client.beginSend(
		toEmailMessage(input),
		operationId ? { operationId } : undefined,
	);
	const result = await poller.pollUntilDone();
	if (result.status !== KnownEmailSendStatus.Succeeded) {
		const message =
			result.error?.message ??
			result.error?.code ??
			`Email send failed with status ${result.status}`;
		throw new Error(message);
	}
	return result.id;
}
