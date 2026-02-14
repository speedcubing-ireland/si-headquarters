import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Dices, Loader2, Upload, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getInitials } from "@/lib/format-utils";

export const Route = createFileRoute("/account")({
	component: RouteComponent,
});

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const AVATAR_ACCEPT_TYPES =
	"image/png,image/jpeg,image/webp,image/gif,image/avif";

function toErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message.trim()) {
		return error.message;
	}
	return fallback;
}

function RouteComponent() {
	const user = useQuery(api.users.getCurrentUser);
	const updateCurrentUserName = useMutation(api.users.updateCurrentUserName);
	const generateAvatarUploadUrl = useMutation(
		api.users.generateAvatarUploadUrl,
	);
	const setCurrentUserAvatarFromStorage = useMutation(
		api.users.setCurrentUserAvatarFromStorage,
	);
	const rerollCurrentUserAvatar = useMutation(
		api.users.rerollCurrentUserAvatar,
	);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [nameInput, setNameInput] = useState("");
	const [isSavingName, setIsSavingName] = useState(false);
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const [isRerollingAvatar, setIsRerollingAvatar] = useState(false);

	useEffect(() => {
		if (!user) return;
		setNameInput(user.name ?? "");
	}, [user]);

	const onSaveName = async (event: FormEvent) => {
		event.preventDefault();
		const nextName = nameInput.trim();
		if (!nextName || !user) {
			return;
		}
		setIsSavingName(true);
		try {
			await updateCurrentUserName({ name: nextName });
			toast.success("Name updated.");
		} catch (error) {
			toast.error(toErrorMessage(error, "Failed to update name."));
		} finally {
			setIsSavingName(false);
		}
	};

	const onUploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.currentTarget.value = "";
		if (!file) {
			return;
		}
		if (!file.type.startsWith("image/")) {
			toast.error("Please choose an image file.");
			return;
		}
		if (file.size > MAX_AVATAR_SIZE_BYTES) {
			toast.error("Avatar must be 5MB or smaller.");
			return;
		}
		setIsUploadingAvatar(true);
		try {
			const uploadUrl = await generateAvatarUploadUrl();
			const uploadResponse = await fetch(uploadUrl, {
				method: "POST",
				headers: {
					"Content-Type": file.type,
				},
				body: file,
			});
			if (!uploadResponse.ok) {
				throw new Error("Upload failed.");
			}
			const result = (await uploadResponse.json()) as {
				storageId?: Id<"_storage">;
			};
			if (!result.storageId) {
				throw new Error("Upload did not return a storage ID.");
			}
			await setCurrentUserAvatarFromStorage({ storageId: result.storageId });
			toast.success("Avatar updated.");
		} catch (error) {
			toast.error(toErrorMessage(error, "Failed to upload avatar."));
		} finally {
			setIsUploadingAvatar(false);
		}
	};

	const onRerollAvatar = async () => {
		setIsRerollingAvatar(true);
		try {
			await rerollCurrentUserAvatar();
			toast.success("New avatar generated.");
		} catch (error) {
			toast.error(toErrorMessage(error, "Failed to reroll avatar."));
		} finally {
			setIsRerollingAvatar(false);
		}
	};

	if (user === undefined) {
		return (
			<div className="flex min-h-[50vh] items-center justify-center">
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (user === null) {
		return (
			<div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
				Unable to load account details.
			</div>
		);
	}

	const displayName = user.name ?? user.email ?? "User";
	const trimmedName = nameInput.trim();
	const canSaveName = trimmedName.length > 0 && trimmedName !== user.name;
	const avatarBusy = isUploadingAvatar || isRerollingAvatar;

	return (
		<div className="flex flex-1 flex-col">
			<header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:px-4 lg:h-12 lg:flex-nowrap lg:px-6 lg:py-0">
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<SidebarTrigger className="shrink-0" />
					<Separator
						orientation="vertical"
						className="hidden data-[orientation=vertical]:h-3 sm:block"
					/>
					<UserRound className="size-4 text-muted-foreground" />
					<h1 className="text-sm font-semibold">Account</h1>
				</div>
			</header>
			<div className="flex-1 p-4 lg:p-6">
				<div className="mx-auto w-full max-w-3xl">
					<Card>
						<CardHeader>
							<CardTitle>Profile</CardTitle>
							<CardDescription>
								Update your display name and avatar.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
								<Avatar className="size-20">
									<AvatarImage src={user.image} alt={displayName} />
									<AvatarFallback>{getInitials(displayName)}</AvatarFallback>
								</Avatar>
								<div className="flex flex-wrap gap-2">
									<input
										ref={fileInputRef}
										type="file"
										accept={AVATAR_ACCEPT_TYPES}
										className="hidden"
										onChange={(event) => void onUploadAvatar(event)}
										disabled={avatarBusy}
									/>
									<Button
										type="button"
										variant="outline"
										disabled={avatarBusy}
										onClick={() => fileInputRef.current?.click()}
									>
										{isUploadingAvatar ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											<Upload className="size-4" />
										)}
										Upload avatar
									</Button>
									<Button
										type="button"
										variant="outline"
										disabled={avatarBusy}
										onClick={() => void onRerollAvatar()}
									>
										{isRerollingAvatar ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											<Dices className="size-4" />
										)}
										Reroll shapes avatar
									</Button>
								</div>
							</div>
							<form
								className="space-y-4"
								onSubmit={(event) => void onSaveName(event)}
							>
								<div className="space-y-2">
									<Label htmlFor="account-name">Name</Label>
									<Input
										id="account-name"
										value={nameInput}
										onChange={(event) => setNameInput(event.target.value)}
										disabled={isSavingName}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="account-email">Email</Label>
									<Input
										id="account-email"
										value={user.email ?? ""}
										readOnly
										disabled
									/>
								</div>
								<Button type="submit" disabled={!canSaveName || isSavingName}>
									{isSavingName ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										"Save name"
									)}
								</Button>
							</form>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
