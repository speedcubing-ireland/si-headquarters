type ConvexArgValue = string | undefined;
type ConvexArgs = Record<string, ConvexArgValue>;

type OAuthAuthResponse = {
	url: string;
	state?: string;
};

type OAuthExchangeResponse = {
	success: boolean;
	error?: string;
};

type OAuthFlowStatus = "pending" | "success" | "error";

const HTML_HEADERS = { "Content-Type": "text/html; charset=utf-8" } as const;

export type OAuthTerminalFlowConfig = {
	providerDisplayName: string;
	successHeading: string;
	commandName: `auth:${string}`;
	port: number;
	redirectUri: string;
	redirectHint?: string;
	authPath: string;
	exchangePath: string;
	authArgs?: ConvexArgs;
	exchangeArgs?: ConvexArgs;
	missingAuthUrlMessage: string;
	usePkce?: boolean;
	useState?: boolean;
};

export async function convexRun<T>(path: string, args: ConvexArgs): Promise<T> {
	const filteredArgs = Object.fromEntries(
		Object.entries(args).filter(([_, value]) => value !== undefined),
	) as Record<string, string>;
	const prod = process.env.CONVEX_PROD === "1" || process.env.CONVEX_PROD === "true";
	const proc = Bun.spawn(
		["bunx", "convex", "run", ...(prod ? ["--prod"] : []), path, JSON.stringify(filteredArgs)],
		{
			cwd: `${import.meta.dir}/../..`,
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const exit = await proc.exited;
	if (exit !== 0) {
		console.error(stderr || stdout);
		throw new Error(`convex run failed with exit ${exit}`);
	}
	return JSON.parse(stdout.trim()) as T;
}

export function openBrowser(url: string): void {
	const platform = process.platform;
	if (platform === "darwin") {
		Bun.spawn({ cmd: ["open", url], stdout: "ignore", stderr: "ignore" });
		return;
	}
	if (platform === "win32") {
		Bun.spawn({
			cmd: ["cmd", "/c", "start", "", url],
			stdout: "ignore",
			stderr: "ignore",
		});
		return;
	}
	Bun.spawn({
		cmd: ["xdg-open", url],
		stdout: "ignore",
		stderr: "ignore",
	});
}

function htmlOk(heading: string) {
	return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${heading}</title></head>
<body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:1rem;text-align:center">
  <h1>${heading}</h1>
  <p>You can close this tab and return to the terminal.</p>
</body></html>
`;
}

function htmlErr(msg: string) {
	return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Error</title></head>
<body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:1rem;text-align:center">
  <h1>Linking failed</h1>
  <p style="color:red">${msg.replace(/</g, "&lt;")}</p>
  <p>You can close this tab and try again in the terminal.</p>
</body></html>
`;
}

function toBase64Url(bytes: Uint8Array): string {
	return Buffer.from(bytes)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

async function generatePkce() {
	const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
	const codeVerifier = toBase64Url(verifierBytes);
	const hash = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(codeVerifier),
	);
	const codeChallenge = toBase64Url(new Uint8Array(hash));
	return { codeVerifier, codeChallenge };
}

function requireCliToken(commandName: string): string | null {
	const cliToken = process.env.CLI_AUTH_TOKEN;
	if (cliToken) return cliToken;

	console.error(
		"Error: CLI_AUTH_TOKEN environment variable is not set.\n" +
			"Set it in your Convex dashboard as an environment variable,\n" +
			"then export it before running this script:\n" +
			"  export CLI_AUTH_TOKEN=your-secret-token\n" +
			`  bun run ${commandName}`,
	);
	return null;
}

export async function runOAuthTerminalFlow(
	config: OAuthTerminalFlowConfig,
): Promise<boolean> {
	const prod = process.env.CONVEX_PROD === "1" || process.env.CONVEX_PROD === "true";
	console.log(
		`${config.providerDisplayName} OAuth (terminal flow)${prod ? " [production]" : ""}\n`,
	);
	const redirectLines = [`Redirect URI: ${config.redirectUri}`];
	if (config.redirectHint) {
		redirectLines.push(config.redirectHint);
	}
	console.log(`${redirectLines.join("\n")}\n`);

	const cliToken = requireCliToken(config.commandName);
	if (!cliToken) return false;

	const pkce = config.usePkce ? await generatePkce() : null;
	const requestedState = config.useState ? crypto.randomUUID() : undefined;
	const auth = await convexRun<OAuthAuthResponse>(config.authPath, {
		redirectUri: config.redirectUri,
		codeChallenge: pkce?.codeChallenge,
		state: requestedState,
		cliToken,
		...config.authArgs,
	});
	if (!auth.url) {
		console.error(config.missingAuthUrlMessage);
		return false;
	}
	const expectedState = config.useState
		? (auth.state ?? requestedState)
		: undefined;

	const onDoneRef: { current: () => void } = { current: () => {} };
	const flowStatusRef: { current: OAuthFlowStatus } = {
		current: "pending",
	};
	const donePromise = new Promise<void>((resolve) => {
		onDoneRef.current = resolve;
	});

	const server = Bun.serve({
		port: config.port,
		async fetch(req) {
			const url = new URL(req.url);
			const code = url.searchParams.get("code");
			if (!code) return new Response("Missing code", { status: 400 });
			if (expectedState) {
				const incomingState = url.searchParams.get("state");
				if (!incomingState || incomingState !== expectedState) {
					flowStatusRef.current = "error";
					onDoneRef.current();
					return new Response(htmlErr("Invalid OAuth state"), {
						headers: HTML_HEADERS,
						status: 400,
					});
				}
			}

			try {
				const response = await convexRun<OAuthExchangeResponse>(
					config.exchangePath,
					{
						code,
						redirectUri: config.redirectUri,
						codeVerifier: pkce?.codeVerifier,
						cliToken,
						...config.exchangeArgs,
					},
				);

				flowStatusRef.current = response.success ? "success" : "error";
				onDoneRef.current();

				if (response.success) {
					return new Response(htmlOk(config.successHeading), {
						headers: HTML_HEADERS,
					});
				}
				return new Response(htmlErr(response.error ?? "Exchange failed"), {
					headers: HTML_HEADERS,
					status: 400,
				});
			} catch (error) {
				flowStatusRef.current = "error";
				onDoneRef.current();
				const message = error instanceof Error ? error.message : String(error);
				return new Response(htmlErr(message), {
					headers: HTML_HEADERS,
					status: 500,
				});
			}
		},
	});

	console.log(`Opening browser for ${config.providerDisplayName} sign-in...\n`);
	openBrowser(auth.url);
	await donePromise;
	server.stop();

	if (flowStatusRef.current === "success") {
		console.log(
			`Done. ${config.providerDisplayName} tokens are stored in Convex.`,
		);
		return true;
	}
	console.error(
		`${config.providerDisplayName} OAuth failed. Tokens were not stored.`,
	);
	return false;
}
