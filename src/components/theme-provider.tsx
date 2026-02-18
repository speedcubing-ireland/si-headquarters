import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	type CustomTheme,
	type ThemeColors,
	themeColorKeys,
	parseCustomTheme,
} from "@/lib/theme-schema";

type Theme =
	| "dark"
	| "light"
	| "system"
	| "custom-light"
	| "custom-dark"
	| "custom-system";

type ThemeProviderProps = {
	children: React.ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
};

type ThemeProviderState = {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	customTheme: CustomTheme | null;
	setCustomTheme: (theme: CustomTheme | null) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | null>(null);

const CUSTOM_THEME_STORAGE_KEY = "vite-ui-custom-theme";

function applyThemeColors(colors: ThemeColors) {
	const root = window.document.documentElement;
	for (const key of themeColorKeys) {
		root.style.setProperty(`--${key}`, colors[key]);
	}
}

function clearCustomThemeColors() {
	const root = window.document.documentElement;
	for (const key of themeColorKeys) {
		root.style.removeProperty(`--${key}`);
	}
}

function getSystemTheme(): "light" | "dark" {
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function isCustomTheme(theme: Theme): boolean {
	return (
		theme === "custom-light" ||
		theme === "custom-dark" ||
		theme === "custom-system"
	);
}

function getCustomThemeMode(theme: Theme): "light" | "dark" | "system" {
	if (theme === "custom-light") return "light";
	if (theme === "custom-dark") return "dark";
	return "system";
}

export function ThemeProvider({
	children,
	defaultTheme = "system",
	storageKey = "vite-ui-theme",
	...props
}: ThemeProviderProps) {
	const [theme, setThemeState] = useState<Theme>(
		() => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
	);

	const [customTheme, setCustomThemeState] = useState<CustomTheme | null>(
		() => {
			if (typeof window === "undefined") return null;
			const stored = localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
			if (!stored) return null;
			const parsed = parseCustomTheme(stored);
			return parsed.success && parsed.data ? parsed.data : null;
		},
	);

	const applyTheme = useCallback(() => {
		const root = window.document.documentElement;

		root.classList.remove("light", "dark", "custom");
		clearCustomThemeColors();

		if (isCustomTheme(theme) && customTheme) {
			const mode = getCustomThemeMode(theme);
			const effectiveMode = mode === "system" ? getSystemTheme() : mode;
			root.classList.add("custom");
			applyThemeColors(customTheme[effectiveMode]);
			return;
		}

		if (theme === "system") {
			root.classList.add(getSystemTheme());
			return;
		}

		root.classList.add(theme);
	}, [theme, customTheme]);

	useEffect(() => {
		applyTheme();
	}, [applyTheme]);

	useEffect(() => {
		if (
			!isCustomTheme(theme) ||
			getCustomThemeMode(theme) !== "system" ||
			!customTheme
		)
			return;

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = () => {
			clearCustomThemeColors();
			applyThemeColors(customTheme[getSystemTheme()]);
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, [theme, customTheme]);

	useEffect(() => {
		const handleStorageChange = (e: StorageEvent) => {
			if (e.key === CUSTOM_THEME_STORAGE_KEY && e.newValue) {
				const parsed = parseCustomTheme(e.newValue);
				if (parsed.success && parsed.data) {
					setCustomThemeState(parsed.data);
				}
			}
		};

		window.addEventListener("storage", handleStorageChange);
		return () => window.removeEventListener("storage", handleStorageChange);
	}, []);

	const setTheme = useCallback(
		(newTheme: Theme) => {
			localStorage.setItem(storageKey, newTheme);
			setThemeState(newTheme);
		},
		[storageKey],
	);

	const setCustomTheme = useCallback((newTheme: CustomTheme | null) => {
		setCustomThemeState(newTheme);
		if (newTheme) {
			localStorage.setItem(
				CUSTOM_THEME_STORAGE_KEY,
				JSON.stringify(newTheme, null, 2),
			);
		} else {
			localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY);
		}
	}, []);

	const value = useMemo(
		() => ({
			theme,
			setTheme,
			customTheme,
			setCustomTheme,
		}),
		[theme, setTheme, customTheme, setCustomTheme],
	);

	return (
		<ThemeProviderContext.Provider {...props} value={value}>
			{children}
		</ThemeProviderContext.Provider>
	);
}

export const useTheme = () => {
	const context = useContext(ThemeProviderContext);

	if (context === null)
		throw new Error("useTheme must be used within a ThemeProvider");

	return context;
};
