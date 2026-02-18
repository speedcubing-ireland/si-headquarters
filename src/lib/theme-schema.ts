import { z } from "zod";

const colorVariableSchema = z.string().min(1);

const themeColorsSchema = z.object({
	background: colorVariableSchema,
	foreground: colorVariableSchema,
	card: colorVariableSchema,
	"card-foreground": colorVariableSchema,
	popover: colorVariableSchema,
	"popover-foreground": colorVariableSchema,
	primary: colorVariableSchema,
	"primary-foreground": colorVariableSchema,
	secondary: colorVariableSchema,
	"secondary-foreground": colorVariableSchema,
	muted: colorVariableSchema,
	"muted-foreground": colorVariableSchema,
	accent: colorVariableSchema,
	"accent-foreground": colorVariableSchema,
	destructive: colorVariableSchema,
	"destructive-foreground": colorVariableSchema,
	border: colorVariableSchema,
	input: colorVariableSchema,
	ring: colorVariableSchema,
	"chart-1": colorVariableSchema,
	"chart-2": colorVariableSchema,
	"chart-3": colorVariableSchema,
	"chart-4": colorVariableSchema,
	"chart-5": colorVariableSchema,
	sidebar: colorVariableSchema,
	"sidebar-foreground": colorVariableSchema,
	"sidebar-primary": colorVariableSchema,
	"sidebar-primary-foreground": colorVariableSchema,
	"sidebar-accent": colorVariableSchema,
	"sidebar-accent-foreground": colorVariableSchema,
	"sidebar-border": colorVariableSchema,
	"sidebar-ring": colorVariableSchema,
	header: colorVariableSchema,
	"header-foreground": colorVariableSchema,
	footer: colorVariableSchema,
	"footer-foreground": colorVariableSchema,
	code: colorVariableSchema,
	"code-foreground": colorVariableSchema,
	"code-highlight": colorVariableSchema,
	"code-number": colorVariableSchema,
	"code-selection": colorVariableSchema,
	"code-border": colorVariableSchema,
	success: colorVariableSchema,
	"success-foreground": colorVariableSchema,
	warning: colorVariableSchema,
	"warning-foreground": colorVariableSchema,
	error: colorVariableSchema,
	"error-foreground": colorVariableSchema,
	info: colorVariableSchema,
	"info-foreground": colorVariableSchema,
});

export const customThemeSchema = z.object({
	name: z.string().min(1),
	light: themeColorsSchema,
	dark: themeColorsSchema,
});

export type CustomTheme = z.infer<typeof customThemeSchema>;

export type ThemeColors = z.infer<typeof themeColorsSchema>;

export const themeColorKeys: readonly (keyof ThemeColors)[] = [
	"background",
	"foreground",
	"card",
	"card-foreground",
	"popover",
	"popover-foreground",
	"primary",
	"primary-foreground",
	"secondary",
	"secondary-foreground",
	"muted",
	"muted-foreground",
	"accent",
	"accent-foreground",
	"destructive",
	"destructive-foreground",
	"border",
	"input",
	"ring",
	"chart-1",
	"chart-2",
	"chart-3",
	"chart-4",
	"chart-5",
	"sidebar",
	"sidebar-foreground",
	"sidebar-primary",
	"sidebar-primary-foreground",
	"sidebar-accent",
	"sidebar-accent-foreground",
	"sidebar-border",
	"sidebar-ring",
	"header",
	"header-foreground",
	"footer",
	"footer-foreground",
	"code",
	"code-foreground",
	"code-highlight",
	"code-number",
	"code-selection",
	"code-border",
	"success",
	"success-foreground",
	"warning",
	"warning-foreground",
	"error",
	"error-foreground",
	"info",
	"info-foreground",
] as const;

const tw = {
	green: {
		400: "oklch(0.792 0.209 151.711)",
		500: "oklch(0.723 0.219 149.579)",
		600: "oklch(0.627 0.194 149.214)",
		700: "oklch(0.527 0.154 150.069)",
	},
	amber: {
		400: "oklch(0.828 0.189 84.429)",
		500: "oklch(0.769 0.188 70.08)",
		600: "oklch(0.666 0.179 58.318)",
		700: "oklch(0.555 0.163 48.998)",
	},
	red: {
		400: "oklch(0.704 0.191 22.216)",
		500: "oklch(0.637 0.237 25.331)",
		600: "oklch(0.577 0.245 27.325)",
		700: "oklch(0.505 0.213 27.518)",
	},
	blue: {
		400: "oklch(0.707 0.165 254.624)",
		500: "oklch(0.623 0.214 259.815)",
		600: "oklch(0.546 0.245 262.881)",
		700: "oklch(0.488 0.243 264.376)",
	},
};

export const defaultLightColors: ThemeColors = {
	background: "oklch(0.9888 0.0045 78.2984)",
	foreground: "oklch(0.3299 0.045 23.9357)",
	card: "oklch(1 0 0)",
	"card-foreground": "oklch(0.3299 0.045 23.9357)",
	popover: "oklch(1 0 0)",
	"popover-foreground": "oklch(0.3299 0.045 23.9357)",
	primary: "oklch(0.6658 0.1574 58.3183)",
	"primary-foreground": "oklch(1 0 0)",
	secondary: "oklch(0.9384 0.0205 74.6569)",
	"secondary-foreground": "oklch(0.5133 0.0906 61.5934)",
	muted: "oklch(0.9384 0.0205 74.6569)",
	"muted-foreground": "oklch(0.4542 0.0419 42.4197)",
	accent: "oklch(0.9482 0.0248 65.5805)",
	"accent-foreground": "oklch(0.6658 0.1574 58.3183)",
	destructive: "oklch(0.6368 0.2078 25.3313)",
	"destructive-foreground": "oklch(1 0 0)",
	border: "oklch(0.8919 0.0199 65.12)",
	input: "oklch(0.8919 0.0199 65.12)",
	ring: "oklch(0.6658 0.1574 58.3183)",
	"chart-1": "oklch(0.6658 0.1574 58.3183)",
	"chart-2": "oklch(0.5133 0.0906 61.5934)",
	"chart-3": "oklch(0.555 0.163 48.998)",
	"chart-4": "oklch(0.646 0.222 41.116)",
	"chart-5": "oklch(0.279 0.077 45.635)",
	sidebar: "oklch(0.9384 0.0205 74.6569)",
	"sidebar-foreground": "oklch(0.3299 0.045 23.9357)",
	"sidebar-primary": "oklch(0.6658 0.1574 58.3183)",
	"sidebar-primary-foreground": "oklch(1 0 0)",
	"sidebar-accent": "oklch(0.9482 0.0248 65.5805)",
	"sidebar-accent-foreground": "oklch(0.6658 0.1574 58.3183)",
	"sidebar-border": "oklch(0.8919 0.0199 65.12)",
	"sidebar-ring": "oklch(0.6658 0.1574 58.3183)",
	header: "oklch(0.9888 0.0045 78.2984)",
	"header-foreground": "oklch(0.3299 0.045 23.9357)",
	footer: "oklch(0.9888 0.0045 78.2984)",
	"footer-foreground": "oklch(0.3299 0.045 23.9357)",
	code: "oklch(0.96 0.015 74.6569)",
	"code-foreground": "oklch(0.3299 0.045 23.9357)",
	"code-highlight": "oklch(0.98 0.01 74.6569)",
	"code-number": "oklch(0.5553 0.1455 48.9975)",
	"code-selection": "oklch(0.9482 0.0248 65.5805)",
	"code-border": "oklch(0.8919 0.0199 65.12)",
	success: tw.green[500],
	"success-foreground": tw.green[700],
	warning: tw.amber[500],
	"warning-foreground": tw.amber[700],
	error: tw.red[500],
	"error-foreground": tw.red[700],
	info: tw.blue[500],
	"info-foreground": tw.blue[700],
};

export const defaultDarkColors: ThemeColors = {
	background: "oklch(0.2312 0.0215 43.6512)",
	foreground: "oklch(0.9384 0.0205 74.6569)",
	card: "oklch(0.2965 0.0293 39.2164)",
	"card-foreground": "oklch(0.9384 0.0205 74.6569)",
	popover: "oklch(0.2965 0.0293 39.2164)",
	"popover-foreground": "oklch(0.9384 0.0205 74.6569)",
	primary: "oklch(0.7049 0.1867 47.6044)",
	"primary-foreground": "oklch(0.2312 0.0215 43.6512)",
	secondary: "oklch(0.3299 0.045 23.9357)",
	"secondary-foreground": "oklch(0.9384 0.0205 74.6569)",
	muted: "oklch(0.3299 0.045 23.9357)",
	"muted-foreground": "oklch(0.7414 0.0271 63.6059)",
	accent: "oklch(0.4542 0.0419 42.4197)",
	"accent-foreground": "oklch(0.7049 0.1867 47.6044)",
	destructive: "oklch(0.5771 0.2152 27.325)",
	"destructive-foreground": "oklch(0.9384 0.0205 74.6569)",
	border: "oklch(0.4542 0.0419 42.4197)",
	input: "oklch(0.4542 0.0419 42.4197)",
	ring: "oklch(0.7049 0.1867 47.6044)",
	"chart-1": "oklch(0.7049 0.1867 47.6044)",
	"chart-2": "oklch(0.6461 0.1943 41.1158)",
	"chart-3": "oklch(0.6658 0.1574 58.3183)",
	"chart-4": "oklch(0.5534 0.1739 38.4022)",
	"chart-5": "oklch(0.5553 0.1455 48.9975)",
	sidebar: "oklch(0.2965 0.0293 39.2164)",
	"sidebar-foreground": "oklch(0.9384 0.0205 74.6569)",
	"sidebar-primary": "oklch(0.7049 0.1867 47.6044)",
	"sidebar-primary-foreground": "oklch(0.2312 0.0215 43.6512)",
	"sidebar-accent": "oklch(0.3299 0.045 23.9357)",
	"sidebar-accent-foreground": "oklch(0.7049 0.1867 47.6044)",
	"sidebar-border": "oklch(0.4542 0.0419 42.4197)",
	"sidebar-ring": "oklch(0.7049 0.1867 47.6044)",
	header: "oklch(0.2312 0.0215 43.6512)",
	"header-foreground": "oklch(0.9384 0.0205 74.6569)",
	footer: "oklch(0.2312 0.0215 43.6512)",
	"footer-foreground": "oklch(0.9384 0.0205 74.6569)",
	code: "oklch(0.2965 0.0293 39.2164)",
	"code-foreground": "oklch(0.9384 0.0205 74.6569)",
	"code-highlight": "oklch(0.3299 0.045 23.9357)",
	"code-number": "oklch(0.6658 0.1574 58.3183)",
	"code-selection": "oklch(0.4542 0.0419 42.4197)",
	"code-border": "oklch(0.4542 0.0419 42.4197)",
	success: tw.green[400],
	"success-foreground": tw.green[600],
	warning: tw.amber[400],
	"warning-foreground": tw.amber[600],
	error: tw.red[400],
	"error-foreground": tw.red[600],
	info: tw.blue[400],
	"info-foreground": tw.blue[600],
};

export function createDefaultCustomTheme(): CustomTheme {
	return {
		name: "My Custom Theme",
		light: defaultLightColors,
		dark: defaultDarkColors,
	};
}

export function parseCustomTheme(json: string): {
	success: boolean;
	data?: CustomTheme;
	error?: string;
} {
	try {
		const parsed = JSON.parse(json);
		const result = customThemeSchema.safeParse(parsed);
		if (result.success && result.data) {
			return { success: true, data: result.data };
		}
		if (result.success) {
			return { success: false, error: "Parsed data is empty" };
		}
		return {
			success: false,
			error: result.error.issues
				.map((issue: z.ZodIssue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("\n"),
		};
	} catch (e) {
		return {
			success: false,
			error: e instanceof Error ? e.message : "Invalid JSON",
		};
	}
}
