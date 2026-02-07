import { EmailClient } from "@azure/communication-email";

type EmailRecipient = {
	address: string;
	displayName?: string;
};

type SendEmailInput = {
	to: EmailRecipient[];
	subject: string;
	html: string;
	plainText: string;
};

let cachedClient: EmailClient | null = null;

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
	const sender = process.env.EMAIL_SENDER_ADDRESS;
	if (!sender) {
		throw new Error("EMAIL_SENDER_ADDRESS environment variable is not set");
	}
	return sender;
}

export async function sendEmail(input: SendEmailInput): Promise<string> {
	const client = getEmailClient();
	const poller = await client.beginSend({
		senderAddress: getSenderAddress(),
		content: {
			subject: input.subject,
			html: input.html,
			plainText: input.plainText,
		},
		recipients: {
			to: input.to,
		},
	});
	const result = await poller.pollUntilDone();
	return result.id;
}
