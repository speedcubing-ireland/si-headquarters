import { useCallback, useMemo, useState } from "react";
import { Loader2, MessageSquare, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
	useChannelDefaults,
	useCompetitionChannels,
	useDiscordMutations,
} from "@/hooks/use-convex-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Id } from "@/convex/_generated/dataModel";
import { CHANNEL_SCOPED_NOTIFICATION_TYPES } from "@/convex/notifications/lib/validators";
import { getNotificationTypeLabel } from "@/lib/notification-utils";
import { onMutationError } from "@/lib/utils";

type ChannelNotificationType =
	(typeof CHANNEL_SCOPED_NOTIFICATION_TYPES)[number];

const ALL_CHANNEL_TYPES = [...CHANNEL_SCOPED_NOTIFICATION_TYPES];

function formatDateShort(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-IE", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function GlobalDefaultsSection() {
	const { defaults, isLoading } = useChannelDefaults();
	const { setChannelDefaults } = useDiscordMutations();
	const [isSaving, setIsSaving] = useState(false);

	const enabledTypes = useMemo(
		() => new Set(defaults?.notificationTypes ?? []),
		[defaults?.notificationTypes],
	);

	const handleToggle = useCallback(
		(type: ChannelNotificationType, enabled: boolean) => {
			if (!defaults) return;
			const next = enabled
				? ([...defaults.notificationTypes, type] as ChannelNotificationType[])
				: (defaults.notificationTypes.filter(
						(t) => t !== type,
					) as ChannelNotificationType[]);
			setIsSaving(true);
			setChannelDefaults({ notificationTypes: next })
				.then(() => toast.success("Global defaults updated."))
				.catch(onMutationError)
				.finally(() => setIsSaving(false));
		},
		[defaults, setChannelDefaults],
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-4">
				<Loader2 className="size-4 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<Settings className="size-4 text-muted-foreground" />
				<p className="text-sm font-medium">Global defaults</p>
				<Badge variant="outline" className="text-xs">
					{enabledTypes.size}/{ALL_CHANNEL_TYPES.length} enabled
				</Badge>
			</div>
			<p className="text-xs text-muted-foreground">
				These notification types are sent to all linked competition channels by
				default. Competitions can override these settings individually.
			</p>
			<div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
				{ALL_CHANNEL_TYPES.map((type) => {
					const isEnabled = enabledTypes.has(type);
					const checkboxId = `global-${type}`;
					return (
						<div
							key={type}
							className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-accent/50"
						>
							<Checkbox
								id={checkboxId}
								checked={isEnabled}
								disabled={isSaving}
								onCheckedChange={(checked) =>
									handleToggle(type, checked === true)
								}
							/>
							<label htmlFor={checkboxId} className="cursor-pointer">
								{getNotificationTypeLabel(type)}
							</label>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function CompetitionChannelRow({
	ch,
	defaults,
}: {
	ch: {
		competitionId: Id<"competitions">;
		competitionName: string;
		compStart: string;
		compEnd: string;
		channelName: string;
		usesGlobalDefaults: boolean;
		notificationTypeOverrides: ChannelNotificationType[];
	};
	defaults: ChannelNotificationType[];
}) {
	const { setCompetitionChannelOverrides, removeCompetitionChannel } =
		useDiscordMutations();
	const [isBusy, setIsBusy] = useState(false);
	const [isEditing, setIsEditing] = useState(false);

	const effectiveTypes = ch.usesGlobalDefaults
		? defaults
		: ch.notificationTypeOverrides;
	const effectiveSet = new Set(effectiveTypes);

	const handleToggle = (type: ChannelNotificationType, enabled: boolean) => {
		const current = ch.usesGlobalDefaults
			? [...defaults]
			: [...ch.notificationTypeOverrides];
		const next = enabled
			? ([...current, type] as ChannelNotificationType[])
			: (current.filter((t) => t !== type) as ChannelNotificationType[]);
		setIsBusy(true);
		setCompetitionChannelOverrides({
			competitionId: ch.competitionId,
			notificationTypeOverrides: next,
		})
			.then(() => toast.success("Override updated."))
			.catch(onMutationError)
			.finally(() => setIsBusy(false));
	};

	const handleResetToDefaults = () => {
		setIsBusy(true);
		setCompetitionChannelOverrides({
			competitionId: ch.competitionId,
			notificationTypeOverrides: [],
		})
			.then(() => {
				toast.success("Reset to global defaults.");
				setIsEditing(false);
			})
			.catch(onMutationError)
			.finally(() => setIsBusy(false));
	};

	const handleRemove = () => {
		if (
			!window.confirm(
				"Remove this Discord channel link? Notifications will stop being sent.",
			)
		)
			return;
		setIsBusy(true);
		removeCompetitionChannel(ch.competitionId)
			.then(() => toast.success("Discord channel link removed."))
			.catch(onMutationError)
			.finally(() => setIsBusy(false));
	};

	return (
		<div className="rounded-lg border border-border/70 p-3">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<p className="truncate font-medium text-sm">{ch.competitionName}</p>
						<Badge variant="outline" className="shrink-0">
							#{ch.channelName}
						</Badge>
						{ch.usesGlobalDefaults ? (
							<Badge variant="secondary" className="shrink-0 text-xs">
								Global defaults
							</Badge>
						) : (
							<Badge variant="default" className="shrink-0 text-xs">
								Override
							</Badge>
						)}
					</div>
					<p className="mt-0.5 text-xs text-muted-foreground">
						{formatDateShort(ch.compStart)} — {formatDateShort(ch.compEnd)} ·{" "}
						{effectiveTypes.length}/{ALL_CHANNEL_TYPES.length} types
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="h-7 text-xs"
						disabled={isBusy}
						onClick={() => setIsEditing(!isEditing)}
					>
						<Settings className="size-3.5" />
					</Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="h-7 text-xs text-destructive hover:text-destructive"
						disabled={isBusy}
						onClick={handleRemove}
					>
						{isBusy ? (
							<Loader2 className="size-3.5 animate-spin" />
						) : (
							<Trash2 className="size-3.5" />
						)}
					</Button>
				</div>
			</div>
			{isEditing && (
				<div className="mt-3 space-y-2 border-t border-border/50 pt-3">
					<div className="flex items-center justify-between">
						<p className="text-xs font-medium text-muted-foreground">
							Override notification types
						</p>
						{!ch.usesGlobalDefaults && (
							<Button
								type="button"
								size="sm"
								variant="ghost"
								className="h-6 text-xs"
								disabled={isBusy}
								onClick={handleResetToDefaults}
							>
								Reset to defaults
							</Button>
						)}
					</div>
					<div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
						{ALL_CHANNEL_TYPES.map((type) => {
							const isEnabled = effectiveSet.has(type);
							const checkboxId = `${ch.competitionId}-${type}`;
							return (
								<div
									key={type}
									className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-accent/50"
								>
									<Checkbox
										id={checkboxId}
										checked={isEnabled}
										disabled={isBusy}
										onCheckedChange={(checked) =>
											handleToggle(type, checked === true)
										}
									/>
									<label htmlFor={checkboxId} className="cursor-pointer">
										{getNotificationTypeLabel(type)}
									</label>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}

export function CompetitionChannelsSection() {
	const { channels, isLoading } = useCompetitionChannels();
	const { defaults } = useChannelDefaults();
	const [query, setQuery] = useState("");

	const filteredChannels = useMemo(() => {
		const trimmed = query.trim().toLowerCase();
		if (!trimmed) return channels;
		return channels.filter(
			(ch) =>
				ch.competitionName.toLowerCase().includes(trimmed) ||
				ch.channelName.toLowerCase().includes(trimmed),
		);
	}, [query, channels]) as {
		competitionId: Id<"competitions">;
		competitionName: string;
		compStart: string;
		compEnd: string;
		channelName: string;
		usesGlobalDefaults: boolean;
		notificationTypeOverrides: ChannelNotificationType[];
	}[];

	const defaultTypes = (defaults?.notificationTypes ??
		[]) as ChannelNotificationType[];

	return (
		<Card>
			<CardHeader className="gap-3">
				<CardTitle className="flex items-center gap-2">
					<MessageSquare className="size-4 text-muted-foreground" />
					Competition Discord Channels
				</CardTitle>
				<p className="text-xs text-muted-foreground">
					Channels act as observers — they receive updates but cannot interact
					with tasks. Configure global defaults below, then override per
					competition as needed.
				</p>
			</CardHeader>
			<CardContent className="space-y-6">
				<GlobalDefaultsSection />

				<div className="space-y-3">
					<div className="flex items-center gap-2">
						<p className="text-sm font-medium">Linked channels</p>
						<Badge variant="outline" className="text-xs">
							{channels.length}
						</Badge>
					</div>
					<Input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Filter by competition or channel name"
					/>
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					) : filteredChannels.length === 0 ? (
						<p className="py-4 text-center text-sm text-muted-foreground">
							{channels.length === 0
								? "No competitions have linked Discord channels. Link a channel from the competition detail page."
								: "No channels match your filter."}
						</p>
					) : (
						<div className="space-y-3">
							{filteredChannels.map((ch) => (
								<CompetitionChannelRow
									key={ch.competitionId}
									ch={ch}
									defaults={defaultTypes}
								/>
							))}
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
