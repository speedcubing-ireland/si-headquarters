import { useState, type KeyboardEvent } from "react";
import type { CheckedState } from "@radix-ui/react-checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DIGEST_OPTIONS } from "@/lib/notification-utils";
import type { SettingSaveState } from "@/lib/notification-settings-view-model";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./settings-section";
import {
	getSubscriptionSaveKey,
	useInboxSettingsModel,
} from "./use-inbox-settings-model";

function SaveStateText({ state }: { state: SettingSaveState }) {
	if (state === "idle") {
		return null;
	}
	const stateCopy = {
		saving: "Saving...",
		saved: "Saved",
		error: "Save failed",
	}[state];
	return (
		<span
			aria-live="polite"
			className={cn(
				"text-xs",
				state === "saved" && "text-success-foreground",
				state === "saving" && "text-muted-foreground",
				state === "error" && "text-destructive",
			)}
		>
			{stateCopy}
		</span>
	);
}

function onEnterCommit(
	event: KeyboardEvent<HTMLInputElement>,
	commit: () => void,
) {
	if (event.key !== "Enter") {
		return;
	}
	event.preventDefault();
	commit();
	event.currentTarget.blur();
}

function toBooleanChecked(state: CheckedState): boolean {
	return state === true;
}

export function InboxSettingsPage() {
	const [overridesOpen, setOverridesOpen] = useState(false);
	const model = useInboxSettingsModel();

	return (
		<div className="space-y-5">
			<div className="rounded-xl border border-border/70 bg-gradient-to-br from-background to-muted/20 p-4 sm:p-5">
				<h1 className="text-base font-semibold">Inbox settings</h1>
				<p className="text-sm text-muted-foreground">
					Control delivery defaults, channel behavior, and subscriptions.
				</p>
				<p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
					{model.isLoading
						? "Syncing settings..."
						: model.lastSavedAt
							? `Last saved at ${model.lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
							: "All settings are up to date."}
				</p>
			</div>

			<div className="grid gap-5 xl:grid-cols-2">
				<SettingsSection
					title="Delivery defaults"
					description="Global defaults for in-app notifications. Per-type overrides can change this below."
					actions={<SaveStateText state={model.defaultDigestSaveState} />}
				>
					<div className="space-y-4">
						<div className="space-y-2">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								Digest mode
							</p>
							<div className="grid gap-2 sm:grid-cols-2">
								{DIGEST_OPTIONS.map((option) => (
									<Button
										key={option.value}
										type="button"
										variant={
											model.defaultDigestMode === option.value
												? "secondary"
												: "outline"
										}
										className="h-9 justify-start text-xs"
										onClick={() => model.setDefaultDigestMode(option.value)}
									>
										{option.label}
									</Button>
								))}
							</div>
						</div>

						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
									Timezone
								</p>
								<SaveStateText state={model.timezoneSaveState} />
							</div>
							<Input
								value={model.timezoneInput}
								onChange={(event) => model.setTimezoneInput(event.target.value)}
								onBlur={() => model.commitTimezone()}
								onKeyDown={(event) =>
									onEnterCommit(event, () => model.commitTimezone())
								}
								placeholder="Europe/Dublin"
							/>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => model.commitTimezone("Europe/Dublin")}
								>
									Use Europe/Dublin
								</Button>
								<p className="text-xs text-muted-foreground">
									Quiet hours use this timezone.
								</p>
							</div>
						</div>

						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
									Quiet hours
								</p>
								<SaveStateText state={model.quietHoursSaveState} />
							</div>
							<div className="rounded-lg border border-border/70 bg-muted/20 p-3">
								<div className="flex items-start justify-between gap-3">
									<div className="space-y-1">
										<Label
											htmlFor="quiet-hours-enabled"
											className="text-sm font-medium"
										>
											Enable quiet hours
										</Label>
										<p className="text-xs text-muted-foreground">
											Pause notifications during this window in {model.timezone}
											.
										</p>
									</div>
									<Checkbox
										id="quiet-hours-enabled"
										checked={model.isQuietHoursEnabled}
										onCheckedChange={(checked) =>
											model.setQuietHoursEnabled(toBooleanChecked(checked))
										}
										aria-label="Enable quiet hours"
									/>
								</div>
								{model.quietHoursSummary ? (
									<p className="mt-2 text-xs text-muted-foreground">
										{model.quietHoursSummary}
									</p>
								) : null}
							</div>
							{model.isQuietHoursEnabled ? (
								<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr),minmax(0,1fr),auto] sm:items-end">
									<div>
										<p className="mb-1 text-xs text-muted-foreground">Start</p>
										<Input
											type="time"
											value={model.quietStartInput}
											onChange={(event) =>
												model.setQuietStartInput(event.target.value)
											}
											onBlur={model.commitQuietHours}
											onKeyDown={(event) =>
												onEnterCommit(event, model.commitQuietHours)
											}
										/>
									</div>
									<div>
										<p className="mb-1 text-xs text-muted-foreground">End</p>
										<Input
											type="time"
											value={model.quietEndInput}
											onChange={(event) =>
												model.setQuietEndInput(event.target.value)
											}
											onBlur={model.commitQuietHours}
											onKeyDown={(event) =>
												onEnterCommit(event, model.commitQuietHours)
											}
										/>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={model.clearQuietHours}
									>
										Clear
									</Button>
								</div>
							) : null}
							{!model.areQuietHoursValid ? (
								<p className="text-xs text-destructive">
									Set both start and end times, or clear both.
								</p>
							) : null}
						</div>
					</div>
				</SettingsSection>

				<SettingsSection
					title="Email notifications"
					description="Search by notification type and apply changes instantly."
					actions={<SaveStateText state={model.emailBulkSaveState} />}
				>
					<div className="space-y-3">
						<div className="flex flex-wrap items-center gap-2">
							<Input
								value={model.emailQuery}
								onChange={(event) => model.setEmailQuery(event.target.value)}
								placeholder="Search email types"
								className="max-w-sm"
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => model.setEmailEnabledForFiltered(true)}
								disabled={!model.emailBulkState.canEnableAll}
							>
								Enable all shown
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => model.setEmailEnabledForFiltered(false)}
								disabled={!model.emailBulkState.canDisableAll}
							>
								Disable all shown
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							Showing {model.emailBulkState.total} types. Enabled:{" "}
							{model.emailBulkState.enabledCount}, disabled:{" "}
							{model.emailBulkState.disabledCount}.
						</p>

						{model.emailRows.length === 0 ? (
							<p className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
								No email notification types match your search.
							</p>
						) : (
							<div className="space-y-2">
								{model.emailRows.map((row) => (
									<div
										key={row.key}
										className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/60 p-3"
									>
										<div className="min-w-0">
											<p className="truncate text-sm font-medium">
												{row.label}
											</p>
											<p className="text-xs text-muted-foreground">
												{row.enabled
													? "Email enabled for this type"
													: "Email disabled"}
											</p>
										</div>
										<div className="flex items-center gap-2">
											<SaveStateText state={row.saveState} />
											<Button
												type="button"
												variant={row.enabled ? "secondary" : "outline"}
												size="sm"
												onClick={() => model.toggleEmail(row)}
											>
												{row.enabled ? "On" : "Off"}
											</Button>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</SettingsSection>

				<SettingsSection
					title="In-app overrides"
					description="Advanced per-type controls that override delivery defaults."
					className="xl:col-span-2"
				>
					<Collapsible open={overridesOpen} onOpenChange={setOverridesOpen}>
						<div className="mb-3 flex items-center justify-between gap-2">
							<CollapsibleTrigger asChild>
								<Button variant="outline" size="sm" type="button">
									{overridesOpen
										? "Hide advanced controls"
										: "Show advanced controls"}
								</Button>
							</CollapsibleTrigger>
							<Input
								value={model.overrideQuery}
								onChange={(event) => model.setOverrideQuery(event.target.value)}
								placeholder="Search in-app types"
								className="max-w-sm"
							/>
						</div>
						<CollapsibleContent className="space-y-2">
							{model.inAppRows.length === 0 ? (
								<p className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
									No in-app notification types match your search.
								</p>
							) : (
								model.inAppRows.map((row) => (
									<div
										key={row.key}
										className="rounded-lg border border-border/70 bg-background/60 p-3"
									>
										<div className="flex flex-wrap items-start justify-between gap-2">
											<div>
												<p className="text-sm font-medium">{row.label}</p>
												<p className="text-xs text-muted-foreground">
													{row.isOverride
														? "Override active"
														: "Using global defaults"}
												</p>
											</div>
											<div className="flex items-center gap-2">
												<SaveStateText state={row.saveState} />
												<Badge
													variant={row.isOverride ? "secondary" : "outline"}
												>
													{row.isOverride ? "Override" : "Global"}
												</Badge>
											</div>
										</div>
										<div className="mt-3 flex flex-wrap items-center gap-2">
											{row.isOverride ? (
												<>
													<Button
														type="button"
														variant={row.enabled ? "secondary" : "outline"}
														size="sm"
														onClick={() => model.toggleOverrideEnabled(row)}
													>
														{row.enabled ? "Enabled" : "Disabled"}
													</Button>
													<Button
														type="button"
														variant={
															row.respectQuietHours ? "secondary" : "outline"
														}
														size="sm"
														onClick={() => model.toggleOverrideQuietHours(row)}
													>
														{row.respectQuietHours
															? "Respect quiet hours"
															: "Ignore quiet hours"}
													</Button>
												</>
											) : (
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => model.toggleOverrideEnabled(row)}
												>
													Add override
												</Button>
											)}
											{row.isOverride ? (
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => model.clearOverride(row)}
												>
													Reset to global
												</Button>
											) : null}
										</div>
									</div>
								))
							)}
						</CollapsibleContent>
					</Collapsible>
				</SettingsSection>

				<SettingsSection
					title="Subscriptions"
					description="Manage auto-followed items and clean up stale subscriptions."
					actions={<SaveStateText state={model.subscriptionsBulkSaveState} />}
					className="xl:col-span-2"
				>
					<div className="space-y-3">
						<div className="flex flex-wrap items-center gap-2">
							<Input
								value={model.subscriptionQuery}
								onChange={(event) =>
									model.setSubscriptionQuery(event.target.value)
								}
								placeholder="Search subscriptions"
								className="max-w-sm"
							/>
							<Button
								type="button"
								variant={
									model.subscriptionFilter === "all" ? "secondary" : "outline"
								}
								size="sm"
								onClick={() => model.setSubscriptionFilter("all")}
							>
								All
							</Button>
							<Button
								type="button"
								variant={
									model.subscriptionFilter === "active"
										? "secondary"
										: "outline"
								}
								size="sm"
								onClick={() => model.setSubscriptionFilter("active")}
							>
								Active
							</Button>
							<Button
								type="button"
								variant={
									model.subscriptionFilter === "stale" ? "secondary" : "outline"
								}
								size="sm"
								onClick={() => model.setSubscriptionFilter("stale")}
							>
								Stale
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={model.cleanupStaleSubscriptions}
								disabled={!model.subscriptionsBulkState.canCleanupStale}
							>
								Unsubscribe stale shown
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							Showing {model.subscriptionsBulkState.total} subscriptions.{" "}
							Active: {model.subscriptionsBulkState.activeCount}, stale:{" "}
							{model.subscriptionsBulkState.staleCount}.
						</p>

						{model.subscriptions.length === 0 ? (
							<p className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
								No subscriptions match your filter.
							</p>
						) : (
							<div className="space-y-2">
								{model.subscriptions.map((subscription) => (
									<div
										key={subscription.id}
										className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/60 p-3"
									>
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<p className="truncate text-sm font-medium">
													{subscription.label}
												</p>
												{subscription.isStale ? (
													<Badge variant="outline" className="h-5 text-[10px]">
														Stale
													</Badge>
												) : null}
											</div>
											<p className="text-xs text-muted-foreground">
												{subscription.description ?? subscription.entityType}
											</p>
										</div>
										<div className="flex items-center gap-2">
											<SaveStateText
												state={model.getRowSaveState(
													getSubscriptionSaveKey(subscription.id),
												)}
											/>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => model.unsubscribe(subscription.id)}
											>
												Unsubscribe
											</Button>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</SettingsSection>
			</div>
		</div>
	);
}
