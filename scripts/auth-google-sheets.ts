#!/usr/bin/env bun
// Link Google Sheets OAuth via terminal. Prereqs: Convex linked, AUTH_GOOGLE_* in Convex env, http://localhost:3847 in Google Console redirect URIs.

const PORT = 3847;
const REDIRECT_URI = `http://localhost:${PORT}`;
const HTML_HEADERS = { "Content-Type": "text/html; charset=utf-8" } as const;

async function convexRun(
	path: string,
	args: Record<string, string>,
): Promise<unknown> {
	const proc = Bun.spawn(
		["bunx", "convex", "run", path, JSON.stringify(args)],
		{
			cwd: `${import.meta.dir}/..`,
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
	return JSON.parse(stdout.trim()) as unknown;
}

function openBrowser(url: string): void {
	const platform = process.platform;
	if (platform === "darwin") {
		Bun.spawn({ cmd: ["open", url], stdout: "ignore", stderr: "ignore" });
	} else if (platform === "win32") {
		Bun.spawn({
			cmd: ["cmd", "/c", "start", "", url],
			stdout: "ignore",
			stderr: "ignore",
		});
	} else {
		Bun.spawn({
			cmd: ["xdg-open", url],
			stdout: "ignore",
			stderr: "ignore",
		});
	}
}

const HTML_OK = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Google Sheets linked</title></head>
<body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:1rem;text-align:center">
  <h1>Google Sheets linked</h1>
  <p>You can close this tab and return to the terminal.</p>
</body></html>
`;

const HTML_ERR = (msg: string) => `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Error</title></head>
<body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:1rem;text-align:center">
  <h1>Linking failed</h1>
  <p style="color:red">${msg.replace(/</g, "&lt;")}</p>
  <p>You can close this tab and try again in the terminal.</p>
</body></html>
`;

async function handleCallback(
	code: string,
	onDone: () => void,
): Promise<Response> {
	try {
		const res = (await convexRun("sheets:exchangeCodeAndStoreTokens", {
			code,
			redirectUri: REDIRECT_URI,
		})) as { success: boolean; error?: string };
		onDone();
		if (res.success) {
			return new Response(HTML_OK, { headers: HTML_HEADERS });
		}
		return new Response(HTML_ERR(res.error ?? "Exchange failed"), {
			headers: HTML_HEADERS,
			status: 400,
		});
	} catch (err) {
		onDone();
		const msg = err instanceof Error ? err.message : String(err);
		return new Response(HTML_ERR(msg), {
			headers: HTML_HEADERS,
			status: 500,
		});
	}
}

async function main() {
	console.log("Google Sheets OAuth (terminal flow)\n");
	console.log(
		`Redirect URI: ${REDIRECT_URI}\nAdd it in Google Cloud Console if needed.\n`,
	);

	const result = (await convexRun("sheets:getGoogleOAuthUrl", {
		redirectUri: REDIRECT_URI,
	})) as { url: string };
	if (!result.url) {
		console.error(
			"Could not get OAuth URL. Check AUTH_GOOGLE_ID in Convex env.",
		);
		process.exit(1);
	}

	const onDoneRef: { current: () => void } = { current: () => {} };
	const donePromise = new Promise<void>((r) => {
		onDoneRef.current = r;
	});

	const server = Bun.serve({
		port: PORT,
		async fetch(req) {
			const code = new URL(req.url).searchParams.get("code");
			if (!code) return new Response("Missing code", { status: 400 });
			return handleCallback(code, () => onDoneRef.current());
		},
	});

	console.log("Opening browser for Google sign-in…\n");
	openBrowser(result.url);
	await donePromise;
	server.stop();
	console.log("Done. Google Sheets tokens are stored in Convex.");
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
