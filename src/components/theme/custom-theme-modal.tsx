import {
	Check,
	CircleAlert,
	Loader2,
	Moon,
	Palette,
	RotateCcw,
	Sun,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import { FormModalHeader } from "@/components/shared/form-modal-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	parseCustomTheme,
	createDefaultCustomTheme,
	type CustomTheme,
} from "@/lib/theme-schema";
import { cn } from "@/lib/utils";
import exampleThemes from "./custom-themes.json";

interface CustomThemeModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function getCurrentMode(theme: string): "light" | "dark" {
	if (theme === "dark" || theme === "custom-dark") return "dark";
	if (theme === "light" || theme === "custom-light") return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

export function CustomThemeModal({
	open,
	onOpenChange,
}: CustomThemeModalProps) {
	const { theme, setTheme, customTheme, setCustomTheme } = useTheme();
	const [jsonValue, setJsonValue] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [previewMode, setPreviewMode] = useState<"light" | "dark">(() =>
		getCurrentMode(theme),
	);
	const prevStateRef = useRef<{
		theme: string;
		customTheme: CustomTheme | null;
	} | null>(null);

	const isEmpty = !jsonValue.trim();

	const validationResult = useMemo(() => {
		if (isEmpty) return null;
		return parseCustomTheme(jsonValue);
	}, [jsonValue, isEmpty]);

	const isValid = validationResult?.success ?? false;
	const validationError =
		validationResult?.success === false ? validationResult.error : null;
	const parsedTheme =
		validationResult?.success === true ? validationResult.data : null;

	const applyPreviewWithTheme = useCallback(
		(themeData: CustomTheme, mode: "light" | "dark") => {
			setCustomTheme(themeData);
			setTheme(mode === "light" ? "custom-light" : "custom-dark");
		},
		[setCustomTheme, setTheme],
	);

	useEffect(() => {
		if (open && !prevStateRef.current) {
			prevStateRef.current = { theme, customTheme };
			setPreviewMode(getCurrentMode(theme));
			const initialJson = customTheme
				? JSON.stringify(customTheme, null, 2)
				: "";
			setJsonValue(initialJson);
			if (initialJson) {
				const parsed = parseCustomTheme(initialJson);
				if (parsed.success && parsed.data) {
					applyPreviewWithTheme(parsed.data, getCurrentMode(theme));
				}
			}
		}
	}, [open, theme, customTheme, applyPreviewWithTheme]);

	const handleJsonChange = useCallback(
		(value: string) => {
			setJsonValue(value);
			const parsed = parseCustomTheme(value);
			if (parsed.success && parsed.data) {
				applyPreviewWithTheme(parsed.data, previewMode);
			}
		},
		[previewMode, applyPreviewWithTheme],
	);

	const handleTogglePreviewMode = useCallback(() => {
		setPreviewMode((prev) => {
			const next = prev === "light" ? "dark" : "light";
			if (parsedTheme) {
				applyPreviewWithTheme(parsedTheme, next);
			}
			return next;
		});
	}, [parsedTheme, applyPreviewWithTheme]);

	const restorePreviousTheme = useCallback(() => {
		const prev = prevStateRef.current;
		if (prev) {
			if (prev.customTheme) {
				setCustomTheme(prev.customTheme);
			} else {
				setCustomTheme(null);
			}
			setTheme(
				prev.theme as
					| "light"
					| "dark"
					| "system"
					| "custom-light"
					| "custom-dark"
					| "custom-system",
			);
			prevStateRef.current = null;
		}
	}, [setCustomTheme, setTheme]);

	const handleModalClose = useCallback(
		(newOpen: boolean) => {
			if (!newOpen) {
				restorePreviousTheme();
			}
			if (newOpen) {
				prevStateRef.current = null;
			}
			onOpenChange(newOpen);
		},
		[onOpenChange, restorePreviousTheme],
	);

	const handleSave = useCallback(async () => {
		setIsSaving(true);
		try {
			if (isEmpty) {
				setCustomTheme(null);
				setTheme("system");
				prevStateRef.current = null;
				toast.success("Custom theme cleared");
			} else if (validationResult?.success && validationResult.data) {
				setCustomTheme(validationResult.data);
				setTheme("custom-system");
				prevStateRef.current = null;
				toast.success("Custom theme saved");
			} else {
				toast.error("Please fix validation errors before saving");
				return;
			}
			onOpenChange(false);
		} catch (error) {
			toast.error("Failed to save theme");
			console.error(error);
		} finally {
			setIsSaving(false);
		}
	}, [isEmpty, validationResult, setCustomTheme, setTheme, onOpenChange]);

	const handleReset = useCallback(() => {
		const defaultTheme = createDefaultCustomTheme();
		setJsonValue(JSON.stringify(defaultTheme, null, 2));
		applyPreviewWithTheme(defaultTheme, previewMode);
	}, [previewMode, applyPreviewWithTheme]);

	const handleClear = useCallback(() => {
		setJsonValue("");
	}, []);

	const handleLoadExample = useCallback(
		(theme: CustomTheme) => {
			setJsonValue(JSON.stringify(theme, null, 2));
			applyPreviewWithTheme(theme, previewMode);
		},
		[previewMode, applyPreviewWithTheme],
	);

	const canSave = isEmpty || isValid;

	return (
		<ResponsiveModal
			open={open}
			onOpenChange={handleModalClose}
			dialogContentClassName="sm:max-w-2xl"
		>
			<FormModalHeader title="Customise Theme" />
			<div className="p-6 space-y-6">
				<div className="space-y-2">
					<p className="text-xs text-muted-foreground">
						Click a preset to load it as a starting point, then customize. Leave
						empty to reset to default themes.
					</p>
					<div className="flex flex-wrap gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleReset}
							className="gap-1.5"
						>
							<RotateCcw className="size-3.5" />
							Default
						</Button>
						{exampleThemes.map((theme) => (
							<Button
								key={theme.name}
								variant="outline"
								size="sm"
								onClick={() => handleLoadExample(theme as CustomTheme)}
								className="gap-1.5"
							>
								<span
									className="size-3 rounded-full border"
									style={{ backgroundColor: theme.light.primary }}
								/>
								{theme.name}
							</Button>
						))}
					</div>
				</div>

				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<label htmlFor="theme-json" className="text-sm font-medium">
							Theme JSON
						</label>
						<span className="text-xs text-muted-foreground">
							Edit colors directly in JSON
						</span>
					</div>
					<Textarea
						id="theme-json"
						value={jsonValue}
						onChange={(e) => handleJsonChange(e.target.value)}
						className={cn(
							"font-mono text-xs min-h-[300px] resize-y bg-code text-code-foreground",
							validationError &&
								"border-destructive focus-visible:ring-destructive/20",
						)}
						placeholder='{ "name": "My Theme", "light": { ... }, "dark": { ... } }'
						spellCheck={false}
					/>
					<div className="min-h-[28px]">
						{validationError ? (
							<div className="rounded-md bg-destructive/10 p-3 flex items-start gap-2">
								<CircleAlert className="size-4 text-destructive shrink-0 mt-0.5" />
								<p className="text-xs text-destructive whitespace-pre-wrap font-mono">
									{validationError}
								</p>
							</div>
						) : isEmpty ? (
							<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<Check className="size-3.5" />
								Empty — will reset to default themes
							</div>
						) : isValid ? (
							<div className="flex items-center gap-1.5 text-xs text-success">
								<Check className="size-3.5" />
								Valid theme — previewing {previewMode} mode
							</div>
						) : null}
					</div>
				</div>

				<div className="rounded-md bg-muted/50 p-3 space-y-2">
					<p className="text-xs font-medium">Supported color formats</p>
					<div className="flex flex-wrap gap-2">
						<code className="text-xs bg-background px-2 py-0.5 rounded border">
							oklch(0.7 0.15 180)
						</code>
						<code className="text-xs bg-background px-2 py-0.5 rounded border">
							hsl(200 80% 50%)
						</code>
						<code className="text-xs bg-background px-2 py-0.5 rounded border">
							#3b82f6
						</code>
						<code className="text-xs bg-background px-2 py-0.5 rounded border">
							rgb(59 130 246)
						</code>
					</div>
				</div>
			</div>

			<div className="px-6 py-4 border-t flex justify-between gap-2">
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={handleTogglePreviewMode}
						disabled={!isValid || isEmpty}
						className="gap-1.5"
					>
						{previewMode === "light" ? (
							<Sun className="size-4" />
						) : (
							<Moon className="size-4" />
						)}
						Preview {previewMode === "light" ? "Dark" : "Light"}
					</Button>
					<Button
						variant="outline"
						onClick={handleClear}
						disabled={isEmpty}
						className="gap-1.5"
					>
						<Trash2 className="size-4" />
						Clear
					</Button>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSaving}
					>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={isSaving || !canSave}>
						{isSaving ? (
							<>
								<Loader2 className="size-4 animate-spin mr-2" />
								Saving...
							</>
						) : isEmpty ? (
							<>
								<Trash2 className="size-4 mr-2" />
								Clear Theme
							</>
						) : (
							<>
								<Palette className="size-4 mr-2" />
								Save & Apply
							</>
						)}
					</Button>
				</div>
			</div>
		</ResponsiveModal>
	);
}
